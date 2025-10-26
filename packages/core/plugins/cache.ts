/**
 * 缓存插件 - TypeScript 版本
 * 负责在服务器启动时缓存接口、菜单和角色权限到 Redis
 */

import { Logger } from '../utils/logger.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';
import type { ApiRoute } from '../types/api.js';

/**
 * 缓存管理器类
 */
class CacheManager {
    private appContext: BeflyContext;

    constructor(appContext: BeflyContext) {
        this.appContext = appContext;
    }

    /**
     * 缓存所有接口到 Redis
     */
    async cacheApis(): Promise<void> {
        try {
            // 检查表是否存在
            const tableExists = await this.appContext.db.tableExists('addon_admin_api');
            if (!tableExists) {
                Logger.warn('⚠️ 接口表不存在，跳过接口缓存');
                return;
            }

            // 从数据库查询所有接口（与 apiAll.ts 保持一致）
            const apiList = await this.appContext.db.getAll({
                table: 'addon_admin_api',
                fields: ['id', 'name', 'path', 'method', 'description', 'addonName', 'addonTitle'],
                orderBy: ['addonName#ASC', 'path#ASC']
            });

            // 缓存到 Redis
            const result = await this.appContext.redis.setObject('apis:all', apiList);

            if (result === null) {
                Logger.warn('⚠️ 接口缓存失败');
            } else {
                Logger.info(`✅ 已缓存 ${apiList.length} 个接口到 Redis (Key: apis:all)`);
            }
        } catch (error: any) {
            Logger.error('⚠️ 接口缓存异常:', error);
        }
    }

    /**
     * 缓存所有菜单到 Redis（从数据库读取）
     */
    async cacheMenus(): Promise<void> {
        try {
            // 检查表是否存在
            const tableExists = await this.appContext.db.tableExists('addon_admin_menu');
            if (!tableExists) {
                Logger.warn('⚠️ 菜单表不存在，跳过菜单缓存');
                return;
            }

            // 从数据库查询所有菜单
            const menus = await this.appContext.db.getAll({
                table: 'addon_admin_menu',
                fields: ['id', 'pid', 'name', 'path', 'icon', 'type', 'sort'],
                orderBy: ['sort#ASC', 'id#ASC']
            });

            // 缓存到 Redis
            const result = await this.appContext.redis.setObject('menus:all', menus);

            if (result === null) {
                Logger.warn('⚠️ 菜单缓存失败');
            } else {
                Logger.info(`✅ 已缓存 ${menus.length} 个菜单到 Redis (Key: menus:all)`);
            }
        } catch (error: any) {
            const errorMessage = error?.message || error?.toString?.() || String(error);
            Logger.warn('⚠️ 菜单缓存异常:', errorMessage);
        }
    }

    /**
     * 缓存所有角色的接口权限到 Redis
     */
    async cacheRolePermissions(): Promise<void> {
        try {
            // 检查表是否存在
            const apiTableExists = await this.appContext.db.tableExists('addon_admin_api');
            const roleTableExists = await this.appContext.db.tableExists('addon_admin_role');

            if (!apiTableExists || !roleTableExists) {
                Logger.warn('⚠️ 接口或角色表不存在，跳过角色权限缓存');
                return;
            }

            // 查询所有角色
            const roles = await this.appContext.db.getAll({
                table: 'addon_admin_role',
                fields: ['id', 'code', 'apis']
            });

            // 查询所有接口（用于权限映射）
            const allApis = await this.appContext.db.getAll({
                table: 'addon_admin_api',
                fields: ['id', 'name', 'path', 'method', 'description', 'addonName']
            });

            // 为每个角色缓存接口权限
            let cachedRoles = 0;
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

                // 使用 Redis Set 缓存角色权限（性能优化：SADD + SISMEMBER）
                const redisKey = `role:apis:${role.code}`;

                // 先删除旧数据
                await this.appContext.redis.del(redisKey);

                // 批量添加到 Set
                const result = await this.appContext.redis.sadd(redisKey, roleApiPaths);

                if (result > 0) {
                    cachedRoles++;
                    Logger.debug(`   └ 角色 ${role.code}: ${result} 个接口`);
                }
            }

            Logger.info(`✅ 已缓存 ${cachedRoles} 个角色的接口权限`);
        } catch (error: any) {
            const errorMessage = error?.message || error?.toString?.() || String(error);
            Logger.warn('⚠️ 角色权限缓存异常:', errorMessage);
        }
    }

    /**
     * 缓存所有数据
     */
    async cacheAll(): Promise<void> {
        Logger.info('========== 开始缓存数据到 Redis ==========');

        // 1. 缓存接口
        await this.cacheApis();

        // 2. 缓存菜单
        await this.cacheMenus();

        // 3. 缓存角色权限
        await this.cacheRolePermissions();

        Logger.info('========== 数据缓存完成 ==========\n');
    }
}

/**
 * 缓存插件
 */
const cachePlugin: Plugin = {
    name: '_cache',
    after: ['_db', '_redis'],

    async onInit(befly: BeflyContext): Promise<CacheManager> {
        try {
            const cacheManager = new CacheManager(befly);
            Logger.info('缓存插件初始化成功');
            return cacheManager;
        } catch (error: any) {
            throw error;
        }
    }
};

export default cachePlugin;
