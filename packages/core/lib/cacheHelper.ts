/**
 * 缓存助手 - TypeScript 版本
 * 负责在服务器启动时缓存接口、菜单和角色权限到 Redis
 */

import { Logger } from './logger.js';
import { RedisKeys } from './redisKeys.js';

import type { BeflyContext } from '../types/befly.js';

/**
 * 缓存助手类
 */
export class CacheHelper {
    private befly: BeflyContext;

    /**
     * 构造函数
     * @param befly - Befly 上下文
     */
    constructor(befly: BeflyContext) {
        this.befly = befly;
    }

    /**
     * 缓存所有接口到 Redis
     */
    async cacheApis(): Promise<void> {
        try {
            // 检查表是否存在
            const tableExists = await this.befly.db.tableExists('addon_admin_api');
            if (!tableExists) {
                Logger.warn('⚠️ 接口表不存在，跳过接口缓存');
                return;
            }

            // 从数据库查询所有接口
            const apiList = await this.befly.db.getAll({
                table: 'addon_admin_api',
                fields: ['id', 'name', 'path', 'method', 'description', 'addonName', 'addonTitle'],
                orderBy: ['addonName#ASC', 'path#ASC']
            });

            // 缓存到 Redis
            const result = await this.befly.redis.setObject(RedisKeys.apisAll(), apiList);

            if (result === null) {
                Logger.warn('⚠️ 接口缓存失败');
            } else {
                Logger.info(`✅ 已缓存 ${apiList.length} 个接口到 Redis (Key: ${RedisKeys.apisAll()})`);
            }
        } catch (error: any) {
            Logger.error({ err: error }, '⚠️ 接口缓存异常');
        }
    }

    /**
     * 缓存所有菜单到 Redis（从数据库读取）
     */
    async cacheMenus(): Promise<void> {
        try {
            // 检查表是否存在
            const tableExists = await this.befly.db.tableExists('addon_admin_menu');
            if (!tableExists) {
                Logger.warn('⚠️ 菜单表不存在，跳过菜单缓存');
                return;
            }

            // 从数据库查询所有菜单
            const menus = await this.befly.db.getAll({
                table: 'addon_admin_menu',
                fields: ['id', 'pid', 'name', 'path', 'icon', 'type', 'sort'],
                orderBy: ['sort#ASC', 'id#ASC']
            });

            // 缓存到 Redis
            const result = await this.befly.redis.setObject(RedisKeys.menusAll(), menus);

            if (result === null) {
                Logger.warn('⚠️ 菜单缓存失败');
            } else {
                Logger.info(`✅ 已缓存 ${menus.length} 个菜单到 Redis (Key: ${RedisKeys.menusAll()})`);
            }
        } catch (error: any) {
            Logger.warn({ err: error }, '⚠️ 菜单缓存异常');
        }
    }

    /**
     * 缓存所有角色的接口权限到 Redis
     * 优化：使用 Promise.all 利用 Bun Redis 自动 pipeline 特性
     */
    async cacheRolePermissions(): Promise<void> {
        try {
            // 检查表是否存在
            const apiTableExists = await this.befly.db.tableExists('addon_admin_api');
            const roleTableExists = await this.befly.db.tableExists('addon_admin_role');

            if (!apiTableExists || !roleTableExists) {
                Logger.warn('⚠️ 接口或角色表不存在，跳过角色权限缓存');
                return;
            }

            // 并行查询角色和接口（利用自动 pipeline）
            const [roles, allApis] = await Promise.all([
                this.befly.db.getAll({
                    table: 'addon_admin_role',
                    fields: ['id', 'code', 'apis']
                }),
                this.befly.db.getAll({
                    table: 'addon_admin_api',
                    fields: ['id', 'path', 'method']
                })
            ]);

            // 构建接口 ID -> 路径的映射（避免重复过滤）
            const apiMap = new Map<number, string>();
            for (const api of allApis) {
                apiMap.set(api.id, `${api.method}${api.path}`);
            }

            // 收集需要缓存的角色权限
            const cacheOperations: Array<{ roleCode: string; apiPaths: string[] }> = [];

            for (const role of roles) {
                if (!role.apis) continue;

                // 解析角色的接口 ID 列表并映射到路径
                const apiPaths: string[] = [];
                const apiIds = role.apis.split(',');

                for (const idStr of apiIds) {
                    const id = parseInt(idStr.trim());
                    if (!isNaN(id)) {
                        const path = apiMap.get(id);
                        if (path) {
                            apiPaths.push(path);
                        }
                    }
                }

                if (apiPaths.length > 0) {
                    cacheOperations.push({ roleCode: role.code, apiPaths: apiPaths });
                }
            }

            if (cacheOperations.length === 0) {
                Logger.info('✅ 没有需要缓存的角色权限');
                return;
            }

            // 批量删除旧缓存（利用自动 pipeline）
            const deletePromises = cacheOperations.map((op) => this.befly.redis.del(RedisKeys.roleApis(op.roleCode)));
            await Promise.all(deletePromises);

            // 批量添加新缓存（利用自动 pipeline）
            const addPromises = cacheOperations.map((op) => this.befly.redis.sadd(RedisKeys.roleApis(op.roleCode), op.apiPaths));
            const results = await Promise.all(addPromises);

            // 统计成功缓存的角色数
            const cachedRoles = results.filter((r) => r > 0).length;

            Logger.info(`✅ 已缓存 ${cachedRoles} 个角色的接口权限（共 ${cacheOperations.reduce((sum, op) => sum + op.apiPaths.length, 0)} 个接口）`);
        } catch (error: any) {
            Logger.warn({ err: error }, '⚠️ 角色权限缓存异常');
        }
    }

    /**
     * 缓存所有数据
     */
    async cacheAll(): Promise<void> {
        // 1. 缓存接口
        await this.cacheApis();

        // 2. 缓存菜单
        await this.cacheMenus();

        // 3. 缓存角色权限
        await this.cacheRolePermissions();
    }

    /**
     * 获取缓存的所有接口
     * @returns 接口列表
     */
    async getApis(): Promise<any[]> {
        try {
            const apis = await this.befly.redis.getObject<any[]>(RedisKeys.apisAll());
            return apis || [];
        } catch (error: any) {
            Logger.error({ err: error }, '获取接口缓存失败');
            return [];
        }
    }

    /**
     * 获取缓存的所有菜单
     * @returns 菜单列表
     */
    async getMenus(): Promise<any[]> {
        try {
            const menus = await this.befly.redis.getObject<any[]>(RedisKeys.menusAll());
            return menus || [];
        } catch (error: any) {
            Logger.error({ err: error }, '获取菜单缓存失败');
            return [];
        }
    }

    /**
     * 获取角色的接口权限
     * @param roleCode - 角色代码
     * @returns 接口路径列表
     */
    async getRolePermissions(roleCode: string): Promise<string[]> {
        try {
            const permissions = await this.befly.redis.smembers(RedisKeys.roleApis(roleCode));
            return permissions || [];
        } catch (error: any) {
            Logger.error({ err: error, roleCode: roleCode }, '获取角色权限缓存失败');
            return [];
        }
    }

    /**
     * 检查角色是否有指定接口权限
     * @param roleCode - 角色代码
     * @param apiPath - 接口路径（格式：METHOD/path）
     * @returns 是否有权限
     */
    async checkRolePermission(roleCode: string, apiPath: string): Promise<boolean> {
        try {
            const result = await this.befly.redis.sismember(RedisKeys.roleApis(roleCode), apiPath);
            return result === 1;
        } catch (error: any) {
            Logger.error({ err: error, roleCode: roleCode }, '检查角色权限失败');
            return false;
        }
    }

    /**
     * 删除角色的接口权限缓存
     * @param roleCode - 角色代码
     * @returns 是否删除成功
     */
    async deleteRolePermissions(roleCode: string): Promise<boolean> {
        try {
            const result = await this.befly.redis.del(RedisKeys.roleApis(roleCode));
            if (result > 0) {
                Logger.info(`✅ 已删除角色 ${roleCode} 的权限缓存`);
                return true;
            }
            return false;
        } catch (error: any) {
            Logger.error({ err: error, roleCode: roleCode }, '删除角色权限缓存失败');
            return false;
        }
    }
}
