/**
 * 缓存管理器
 * 负责在服务器启动时缓存接口、菜单和角色权限到 Redis
 */

import { Logger } from '../utils/logger.js';
import type { BeflyContext } from '../types/befly.js';
import type { ApiRoute } from '../types/api.js';

/**
 * 缓存管理器类
 */
export class CacheManager {
    /**
     * 缓存所有接口到 Redis
     * @param apiRoutes - API 路由映射表（已废弃，保留参数以兼容）
     * @param appContext - 应用上下文
     */
    static async cacheApis(apiRoutes: Map<string, ApiRoute>, appContext: BeflyContext): Promise<void> {
        try {
            // 检查表是否存在
            const tableExists = await appContext.db.tableExists('addon_admin_api');
            if (!tableExists) {
                Logger.warn('⚠️ 接口表不存在，跳过接口缓存');
                return;
            }

            // 从数据库查询所有接口（与 apiAll.ts 保持一致）
            const apiList = await appContext.db.getAll({
                table: 'addon_admin_api',
                fields: ['id', 'name', 'path', 'method', 'description', 'addonName'],
                orderBy: ['addonName#ASC', 'path#ASC']
            });

            // 缓存到 Redis
            const result = await appContext.redis.setObject('apis:all', apiList);

            if (result === null) {
                Logger.warn('⚠️ 接口缓存失败');
            } else {
                Logger.info(`✅ 已缓存 ${apiList.length} 个接口到 Redis (Key: apis:all)`);
            }
        } catch (error: any) {
            const errorMessage = error?.message || error?.toString?.() || String(error);
            const errorStack = error?.stack || '';
            Logger.warn('⚠️ 接口缓存异常:', {
                message: errorMessage,
                stack: errorStack,
                raw: error
            });
        }
    }

    /**
     * 缓存所有菜单到 Redis（从数据库读取）
     * @param appContext - 应用上下文
     */
    static async cacheMenus(appContext: BeflyContext): Promise<void> {
        try {
            // 检查表是否存在
            const tableExists = await appContext.db.tableExists('addon_admin_menu');
            if (!tableExists) {
                Logger.warn('⚠️ 菜单表不存在，跳过菜单缓存');
                return;
            }

            // 从数据库查询所有菜单
            const menus = await appContext.db.getAll({
                table: 'addon_admin_menu',
                fields: ['id', 'pid', 'name', 'path', 'icon', 'type', 'sort'],
                orderBy: ['sort#ASC', 'id#ASC']
            });

            // 缓存到 Redis
            const result = await appContext.redis.setObject('menus:all', menus);

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
     * @param appContext - 应用上下文
     */
    static async cacheRolePermissions(appContext: BeflyContext): Promise<void> {
        try {
            // 检查表是否存在
            const apiTableExists = await appContext.db.tableExists('addon_admin_api');
            const roleTableExists = await appContext.db.tableExists('addon_admin_role');

            if (!apiTableExists || !roleTableExists) {
                Logger.warn('⚠️ 接口或角色表不存在，跳过角色权限缓存');
                return;
            }

            // 查询所有角色
            const roles = await appContext.db.getAll({
                table: 'addon_admin_role',
                fields: ['id', 'code', 'apis']
            });

            // 查询所有接口（用于权限映射）
            const allApis = await appContext.db.getAll({
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
                await appContext.redis.del(redisKey);

                // 批量添加到 Set
                const result = await appContext.redis.sadd(redisKey, roleApiPaths);

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
     * 启动时缓存所有数据
     * @param apiRoutes - API 路由映射表
     * @param appContext - 应用上下文
     */
    static async cacheAll(apiRoutes: Map<string, ApiRoute>, appContext: BeflyContext): Promise<void> {
        Logger.info('========== 开始缓存数据到 Redis ==========');

        // 1. 缓存接口
        await this.cacheApis(apiRoutes, appContext);

        // 2. 缓存菜单
        await this.cacheMenus(appContext);

        // 3. 缓存角色权限
        await this.cacheRolePermissions(appContext);

        Logger.info('========== 数据缓存完成 ==========\n');
    }
}
