/**
 * SyncDev 命令 - 同步开发者管理员到数据库
 * - 邮箱: 通过 DEV_EMAIL 环境变量配置（默认 dev@qq.com）
 * - 姓名: 开发者
 * - 密码: 使用 bcrypt 加密，通过 DEV_PASSWORD 环境变量配置
 * - 角色: roleCode=dev, roleType=admin
 * - 表名: addon_admin_admin
 */

import { scanAddons, getAddonDir, normalizeModuleForSync } from 'befly-util';

import { Logger } from '../lib/logger.js';
import { Cipher } from '../lib/cipher.js';
import { Connect } from '../lib/connect.js';
import { DbHelper } from '../lib/dbHelper.js';
import type { SyncDevOptions, SyncDevStats, BeflyOptions } from '../types/index.js';

/**
 * SyncDev 命令主函数
 */
export async function syncDevCommand(config: BeflyOptions, options: SyncDevOptions = {}): Promise<void> {
    try {
        if (options.plan) {
            Logger.debug('[计划] 同步完成后将初始化/更新开发管理员账号（plan 模式不执行）');
            return;
        }

        const devPassword = config.devPassword;
        const devEmail = config.devEmail || 'dev@qq.com';

        if (!devPassword) {
            return;
        }

        // 连接数据库（SQL + Redis）
        await Connect.connect();

        const helper = Connect.getDbHelper();

        // 检查 addon_admin_admin 表是否存在
        const existAdmin = await helper.tableExists('addon_admin_admin');
        if (!existAdmin) {
            return;
        }

        // 检查 addon_admin_role 表是否存在
        const existRole = await helper.tableExists('addon_admin_role');
        if (!existRole) {
            return;
        }

        // 检查 addon_admin_menu 表是否存在
        const existMenu = await helper.tableExists('addon_admin_menu');
        if (!existMenu) {
            return;
        }

        // 查询所有菜单 ID
        const allMenus = await helper.getAll({
            table: 'addon_admin_menu',
            fields: ['id']
        });

        if (!allMenus || !Array.isArray(allMenus)) {
            return;
        }

        const menuIds = allMenus.length > 0 ? allMenus.map((m: any) => m.id).join(',') : '';

        // 查询所有接口 ID
        const existApi = await helper.tableExists('addon_admin_api');
        let apiIds = '';
        if (existApi) {
            const allApis = await helper.getAll({
                table: 'addon_admin_api',
                fields: ['id']
            });

            if (allApis && Array.isArray(allApis) && allApis.length > 0) {
                apiIds = allApis.map((a: any) => a.id).join(',');
            }
        }

        // 查询或创建 dev 角色
        let devRole = await helper.getOne({
            table: 'addon_admin_role',
            where: { code: 'dev' }
        });

        if (devRole) {
            // 更新 dev 角色的菜单和接口权限
            await helper.updData({
                table: 'addon_admin_role',
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
                table: 'addon_admin_role',
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
        }

        // 使用 bcrypt 加密密码
        const hashed = await Cipher.hashPassword(devPassword);

        // 准备开发管理员数据
        const devData = {
            name: '开发者',
            nickname: '开发者',
            email: devEmail,
            username: 'dev',
            password: hashed,
            roleId: devRole.id,
            roleCode: 'dev',
            roleType: 'admin'
        };

        // 查询现有账号
        const existing = await helper.getOne({
            table: 'addon_admin_admin',
            where: { email: devEmail }
        });

        if (existing) {
            // 更新现有账号
            await helper.updData({
                table: 'addon_admin_admin',
                where: { email: devEmail },
                data: devData
            });
        } else {
            // 插入新账号
            await helper.insData({
                table: 'addon_admin_admin',
                data: devData
            });
        }

        // 缓存角色权限数据到 Redis
        try {
            // 检查必要的表是否存在
            const apiTableExists = await helper.tableExists('addon_admin_api');
            const roleTableExists = await helper.tableExists('addon_admin_role');

            if (apiTableExists && roleTableExists) {
                // 查询所有角色
                const roles = await helper.getAll({
                    table: 'addon_admin_role',
                    fields: ['id', 'code', 'apis']
                });

                // 查询所有接口
                const allApis = await helper.getAll({
                    table: 'addon_admin_api',
                    fields: ['id', 'name', 'path', 'method', 'description', 'addonName']
                });

                const redis = Connect.getRedis();

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
                    await redis.sadd(redisKey, ...roleApiPaths);
                }
            }
        } catch (error: any) {
            // 忽略缓存错误
        }
    } catch (error: any) {
        Logger.error('同步开发者管理员失败', error);
        throw error;
    } finally {
        await Database?.disconnect();
    }
}
