/**
 * SyncDev 命令 - 同步开发者管理员到数据库
 * - 邮箱: 通过 DEV_EMAIL 环境变量配置（默认 dev@qq.com）
 * - 姓名: 开发者
 * - 密码: 使用 bcrypt 加密，通过 DEV_PASSWORD 环境变量配置
 * - 角色: 同步 dev, user, admin, guest 四个角色
 *   - dev: 拥有所有菜单和接口权限
 *   - user, admin, guest: 菜单和接口权限为空
 * - 同步完成后：重建角色接口权限缓存到 Redis（极简方案：覆盖更新）
 * - 表名: addon_admin_admin
 */

import { Logger } from '../lib/logger.js';
import { Cipher } from '../lib/cipher.js';
import { Connect } from '../lib/connect.js';
import { CacheHelper } from '../lib/cacheHelper.js';
import { DbHelper } from '../lib/dbHelper.js';
import { RedisHelper } from '../lib/redisHelper.js';
import { beflyConfig } from '../befly.config.js';

import type { SyncDevOptions } from '../types/index.js';

/**
 * SyncDev 命令主函数
 */
export async function syncDevCommand(options: SyncDevOptions = {}): Promise<void> {
    try {
        if (options.plan) {
            Logger.debug('[计划] 同步完成后将初始化/更新开发管理员账号（plan 模式不执行）');
            return;
        }

        if (!beflyConfig.devPassword) {
            // 未配置开发者密码，跳过同步
            return;
        }

        // 连接数据库（SQL + Redis）
        await Connect.connect();

        const redisHelper = new RedisHelper();
        const helper = new DbHelper({ redis: redisHelper } as any, Connect.getSql());

        // 检查 addon_admin_admin 表是否存在
        const existAdmin = await helper.tableExists('addon_admin_admin');
        if (!existAdmin) {
            Logger.debug('[SyncDev] 表 addon_admin_admin 不存在，跳过开发者账号同步');
            return;
        }

        // 检查 addon_admin_role 表是否存在
        const existRole = await helper.tableExists('addon_admin_role');
        if (!existRole) {
            Logger.debug('[SyncDev] 表 addon_admin_role 不存在，跳过开发者账号同步');
            return;
        }

        // 检查 addon_admin_menu 表是否存在
        const existMenu = await helper.tableExists('addon_admin_menu');
        if (!existMenu) {
            Logger.debug('[SyncDev] 表 addon_admin_menu 不存在，跳过开发者账号同步');
            return;
        }

        // 查询所有菜单 ID
        const allMenus = await helper.getAll({
            table: 'addon_admin_menu',
            fields: ['id'],
            orderBy: ['id#ASC']
        });

        if (!allMenus || !Array.isArray(allMenus.lists)) {
            Logger.debug('[SyncDev] 菜单数据为空，跳过开发者账号同步');
            return;
        }

        const menuIds = allMenus.lists.length > 0 ? allMenus.lists.map((m: any) => m.id) : [];

        // 查询所有接口 ID
        const existApi = await helper.tableExists('addon_admin_api');
        let apiIds: number[] = [];
        if (existApi) {
            const allApis = await helper.getAll({
                table: 'addon_admin_api',
                fields: ['id'],
                orderBy: ['id#ASC']
            });

            if (allApis && Array.isArray(allApis.lists) && allApis.lists.length > 0) {
                apiIds = allApis.lists.map((a: any) => a.id);
            }
        }

        // 定义四个角色的配置
        const roles = [
            {
                code: 'dev',
                name: '开发者角色',
                description: '拥有所有菜单和接口权限的开发者角色',
                menus: menuIds,
                apis: apiIds,
                sort: 0
            },
            {
                code: 'user',
                name: '用户角色',
                description: '普通用户角色',
                menus: [],
                apis: [],
                sort: 1
            },
            {
                code: 'admin',
                name: '管理员角色',
                description: '管理员角色',
                menus: [],
                apis: [],
                sort: 2
            },
            {
                code: 'guest',
                name: '访客角色',
                description: '访客角色',
                menus: [],
                apis: [],
                sort: 3
            }
        ];

        // 同步所有角色
        let devRole = null;
        for (const roleConfig of roles) {
            const existingRole = await helper.getOne({
                table: 'addon_admin_role',
                where: { code: roleConfig.code }
            });

            if (existingRole) {
                // 检查字段是否有变化
                const existingMenusJson = JSON.stringify(existingRole.menus || []);
                const existingApisJson = JSON.stringify(existingRole.apis || []);
                const nextMenusJson = JSON.stringify(roleConfig.menus);
                const nextApisJson = JSON.stringify(roleConfig.apis);

                const hasChanges = existingRole.name !== roleConfig.name || existingRole.description !== roleConfig.description || existingMenusJson !== nextMenusJson || existingApisJson !== nextApisJson || existingRole.sort !== roleConfig.sort;

                if (hasChanges) {
                    // 更新现有角色
                    await helper.updData({
                        table: 'addon_admin_role',
                        where: { code: roleConfig.code },
                        data: {
                            name: roleConfig.name,
                            description: roleConfig.description,
                            menus: roleConfig.menus,
                            apis: roleConfig.apis,
                            sort: roleConfig.sort
                        }
                    });
                }
                if (roleConfig.code === 'dev') {
                    devRole = existingRole;
                }
            } else {
                // 创建新角色
                const roleId = await helper.insData({
                    table: 'addon_admin_role',
                    data: roleConfig
                });
                if (roleConfig.code === 'dev') {
                    devRole = { id: roleId };
                }
            }
        }

        if (!devRole) {
            Logger.error('dev 角色不存在，无法创建开发者账号');
            return;
        }

        // 先对密码进行 SHA-256 + 盐值 哈希（模拟前端加密），再用 bcrypt 存储
        const sha256Hashed = Cipher.sha256(beflyConfig.devPassword + 'befly');
        const hashed = await Cipher.hashPassword(sha256Hashed);

        // 准备开发管理员数据
        const devData = {
            nickname: '开发者',
            email: beflyConfig.devEmail,
            username: 'dev',
            password: hashed,
            roleCode: 'dev',
            roleType: 'admin'
        };

        // 查询现有账号
        const existing = await helper.getOne({
            table: 'addon_admin_admin',
            where: { email: beflyConfig.devEmail }
        });

        if (existing) {
            // 更新现有账号
            await helper.updData({
                table: 'addon_admin_admin',
                where: { email: beflyConfig.devEmail },
                data: devData
            });
        } else {
            // 插入新账号
            await helper.insData({
                table: 'addon_admin_admin',
                data: devData
            });
        }

        // 重建角色接口权限缓存到 Redis（极简方案：覆盖更新）
        // 说明：syncDev 会修改角色 apis，需同步刷新对应角色权限缓存
        try {
            Logger.debug('[SyncDev] 开始重建角色接口权限缓存');
            const cacheHelper = new CacheHelper({ db: helper, redis: redisHelper } as any);
            await cacheHelper.rebuildRoleApiPermissions();
            Logger.debug('[SyncDev] 角色接口权限缓存重建完成');
        } catch (error: any) {
            Logger.warn({ err: error }, '[SyncDev] 重建角色接口权限缓存失败');
        }
    } catch (error: any) {
        Logger.error({ err: error }, '同步开发者管理员失败');
        throw error;
    } finally {
        await Connect.disconnect();
    }
}
