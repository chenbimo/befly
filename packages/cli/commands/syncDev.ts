/**
 * SyncDev 命令 - 同步开发者管理员到数据库
 * - 邮箱: 通过 DEV_EMAIL 环境变量配置（默认 dev@qq.com）
 * - 姓名: 开发者
 * - 密码: 使用 bcrypt 加密，通过 DEV_PASSWORD 环境变量配置
 * - 角色: roleCode=dev, roleType=admin
 * - 表名: core_admin
 */

import { Logger } from '../util.js';
import { Cipher } from '../lib/cipher.js';
import { Database } from '../lib/database.js';
import { Env } from '../env.js';
import type { SyncDevOptions, SyncDevStats } from '../types.js';

/**
 * SyncDev 命令主函数
 */
export async function syncDevCommand(options: SyncDevOptions = {}): Promise<SyncDevStats> {
    try {
        if (options.plan) {
            Logger.info('[计划] 同步完成后将初始化/更新开发管理员账号（plan 模式不执行）');
            return { adminCount: 0, roleCount: 0, cachedRoles: 0 };
        }

        if (!Env.DEV_PASSWORD) {
            return { adminCount: 0, roleCount: 0, cachedRoles: 0 };
        }

        // 连接数据库（SQL + Redis）
        await Database.connect();

        const helper = Database.getDbHelper();

        // 检查 core_admin 表是否存在
        const existAdmin = await helper.tableExists('core_admin');
        if (!existAdmin) {
            return { adminCount: 0, roleCount: 0, cachedRoles: 0 };
        }

        // 检查 core_role 表是否存在
        const existRole = await helper.tableExists('core_role');
        if (!existRole) {
            return { adminCount: 0, roleCount: 0, cachedRoles: 0 };
        }

        // 检查 core_menu 表是否存在
        const existMenu = await helper.tableExists('core_menu');
        if (!existMenu) {
            return { adminCount: 0, roleCount: 0, cachedRoles: 0 };
        }

        // 查询所有菜单 ID
        const allMenus = await helper.getAll({
            table: 'core_menu',
            fields: ['id']
        });

        if (!allMenus || !Array.isArray(allMenus)) {
            return { adminCount: 0, roleCount: 0, cachedRoles: 0 };
        }

        const menuIds = allMenus.length > 0 ? allMenus.map((m: any) => m.id).join(',') : '';

        // 查询所有接口 ID
        const existApi = await helper.tableExists('core_api');
        let apiIds = '';
        if (existApi) {
            const allApis = await helper.getAll({
                table: 'core_api',
                fields: ['id']
            });

            if (allApis && Array.isArray(allApis) && allApis.length > 0) {
                apiIds = allApis.map((a: any) => a.id).join(',');
            }
        }

        // 查询或创建 dev 角色
        let devRole = await helper.getOne({
            table: 'core_role',
            where: { code: 'dev' }
        });

        if (devRole) {
            // 更新 dev 角色的菜单和接口权限
            await helper.updData({
                table: 'core_role',
                where: { code: 'dev' },
                data: {
                    name: '开发者角色',
                    description: '拥有所有菜单和接口权限的开发者角色',
                    menus: menuIds,
                    apis: apiIds
                }
            });
        } else {
            // 创建 dev 角色
            const roleId = await helper.insData({
                table: 'core_role',
                data: {
                    name: '开发者角色',
                    code: 'dev',
                    description: '拥有所有菜单和接口权限的开发者角色',
                    menus: menuIds,
                    apis: apiIds,
                    sort: 0
                }
            });
            devRole = { id: roleId };
            Logger.info('dev 角色已创建');
        }

        // 使用 bcrypt 加密密码
        const hashed = await Cipher.hashPassword(Env.DEV_PASSWORD);

        // 准备开发管理员数据
        const devData = {
            name: '开发者',
            nickname: '开发者',
            email: Env.DEV_EMAIL,
            username: 'dev',
            password: hashed,
            roleId: devRole.id,
            roleCode: 'dev',
            roleType: 'admin'
        };

        // 查询现有账号
        const existing = await helper.getOne({
            table: 'core_admin',
            where: { email: Env.DEV_EMAIL }
        });

        let isNew = false;
        if (existing) {
            // 更新现有账号
            await helper.updData({
                table: 'core_admin',
                where: { email: Env.DEV_EMAIL },
                data: devData
            });
        } else {
            // 插入新账号
            await helper.insData({
                table: 'core_admin',
                data: devData
            });
            isNew = true;
        }

        // 缓存角色权限数据到 Redis
        let cachedRolesCount = 0;
        try {
            // 检查必要的表是否存在
            const apiTableExists = await helper.tableExists('core_api');
            const roleTableExists = await helper.tableExists('core_role');

            if (apiTableExists && roleTableExists) {
                // 查询所有角色
                const roles = await helper.getAll({
                    table: 'core_role',
                    fields: ['id', 'code', 'apis']
                });

                // 查询所有接口
                const allApis = await helper.getAll({
                    table: 'core_api',
                    fields: ['id', 'name', 'path', 'method', 'description', 'addonName']
                });

                const redis = Database.getRedis();

                // 为每个角色缓存接口权限
                for (const role of roles) {
                    if (!role.apis) continue;

                    // 解析角色的接口 ID 列表
                    const apiIds = role.apis
                        .split(',')
                        .map((id: string) => parseInt(id.trim()))
                        .filter((id: number) => !isNaN(id));

                    // 根据 ID 过滤出接口路径
                    const roleApiPaths = allApis.filter((api: any) => apiIds.includes(api.id)).map((api: any) => `${api.method}${api.path}`);

                    if (roleApiPaths.length === 0) continue;

                    // 使用 Redis Set 缓存角色权限
                    const redisKey = `role:apis:${role.code}`;

                    // 先删除旧数据
                    await redis.del(redisKey);

                    // 批量添加到 Set（使用扩展运算符展开数组）
                    const result = await redis.sadd(redisKey, ...roleApiPaths);

                    if (result > 0) {
                        cachedRolesCount++;
                    }
                }
            }
        } catch (error: any) {
            // 忽略缓存错误
        }

        // 获取统计数据
        const allAdmins = await helper.getAll({
            table: 'core_admin',
            fields: ['id']
        });
        const allRoles = await helper.getAll({
            table: 'core_role',
            fields: ['id']
        });

        return {
            adminCount: allAdmins.length,
            roleCount: allRoles.length,
            cachedRoles: cachedRolesCount
        };
    } catch (error: any) {
        Logger.error('开发管理员同步失败:', error);
        process.exit(1);
    } finally {
        await Database?.disconnect();
    }
}
