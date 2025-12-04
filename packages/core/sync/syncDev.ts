/**
 * SyncDev 命令 - 同步开发者管理员到数据库
 * - 邮箱: 通过 DEV_EMAIL 环境变量配置（默认 dev@qq.com）
 * - 姓名: 开发者
 * - 密码: 使用 bcrypt 加密，通过 DEV_PASSWORD 环境变量配置
 * - 角色: roleCode=dev, roleType=admin
 * - 表名: addon_admin_admin
 */

import { Logger } from '../lib/logger.js';
import { Cipher } from '../lib/cipher.js';
import { Connect } from '../lib/connect.js';
import { DbHelper } from '../lib/dbHelper.js';
import { RedisHelper } from '../lib/redisHelper.js';
import { CacheHelper } from '../lib/cacheHelper.js';
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

        const helper = new DbHelper({ redis: new RedisHelper() } as any, Connect.getSql());

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
            fields: ['id']
        });

        if (!allMenus || !Array.isArray(allMenus)) {
            Logger.debug('[SyncDev] 菜单数据为空，跳过开发者账号同步');
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

        // 先对密码进行 SHA-256 + 盐值 哈希（模拟前端加密），再用 bcrypt 存储
        const sha256Hashed = Cipher.sha256(beflyConfig.devPassword + 'befly');
        const hashed = await Cipher.hashPassword(sha256Hashed);

        // 准备开发管理员数据
        const devData = {
            nickname: '开发者',
            email: beflyConfig.devEmail,
            username: 'dev',
            password: hashed,
            roleId: devRole.id,
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

        // 缓存角色权限数据到 Redis（复用 CacheHelper 逻辑）
        try {
            const tempBefly = { db: helper, redis: new RedisHelper() } as any;
            const cacheHelper = new CacheHelper(tempBefly);
            await cacheHelper.cacheRolePermissions();
        } catch (error: any) {
            // 忽略缓存错误
        }
    } catch (error: any) {
        Logger.error({ err: error }, '同步开发者管理员失败');
        throw error;
    } finally {
        await Connect.disconnect();
    }
}
