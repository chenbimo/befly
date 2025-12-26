/**
 * 缓存助手 - TypeScript 版本
 * 负责在服务器启动时缓存接口、菜单和角色权限到 Redis
 */

import { CacheKeys } from "./cacheKeys.js";
import { Logger } from "./logger.js";

type CacheHelperDb = {
    tableExists(table: string): Promise<boolean>;
    getAll(options: any): Promise<{ lists: any[] }>;
};

type CacheHelperRedis = {
    setObject<T = any>(key: string, obj: T, ttl?: number | null): Promise<string | null>;
    getObject<T = any>(key: string): Promise<T | null>;
    del(key: string): Promise<number>;
    delBatch(keys: string[]): Promise<number>;
    sadd(key: string, members: string[]): Promise<number>;
    saddBatch(items: Array<{ key: string; members: string[] }>): Promise<number>;
    smembers(key: string): Promise<string[]>;
    sismember(key: string, member: string): Promise<boolean>;
};

type CacheHelperDeps = {
    db: CacheHelperDb;
    redis: CacheHelperRedis;
};

/**
 * 缓存助手类
 */
export class CacheHelper {
    private db: CacheHelperDb;
    private redis: CacheHelperRedis;

    private static readonly API_ID_IN_CHUNK_SIZE = 1000;

    constructor(deps: CacheHelperDeps) {
        this.db = deps.db;
        this.redis = deps.redis;
    }

    private normalizeNumberIdList(value: unknown): number[] {
        if (value === null || value === undefined) return [];

        const normalizeSingle = (item: unknown): number | null => {
            if (typeof item === "number") {
                if (!Number.isFinite(item)) return null;
                const intValue = Math.trunc(item);
                return Number.isSafeInteger(intValue) ? intValue : null;
            }
            if (typeof item === "bigint") {
                const intValue = Number(item);
                return Number.isSafeInteger(intValue) ? intValue : null;
            }
            if (typeof item === "string") {
                const trimmed = item.trim();
                if (!trimmed) return null;
                const intValue = Number.parseInt(trimmed, 10);
                return Number.isSafeInteger(intValue) ? intValue : null;
            }
            return null;
        };

        if (Array.isArray(value)) {
            const ids: number[] = [];
            for (const item of value) {
                const id = normalizeSingle(item);
                if (id !== null) ids.push(id);
            }
            return ids;
        }

        if (typeof value === "string") {
            const str = value.trim();
            if (!str) return [];

            if (str.startsWith("[")) {
                try {
                    const parsed = JSON.parse(str);
                    return this.normalizeNumberIdList(parsed);
                } catch {
                    // ignore
                }
            }

            const ids: number[] = [];
            const parts = str.split(",");
            for (const part of parts) {
                const id = normalizeSingle(part);
                if (id !== null) ids.push(id);
            }
            return ids;
        }

        const single = normalizeSingle(value);
        return single === null ? [] : [single];
    }

    private chunkNumberArray(arr: number[], chunkSize: number): number[][] {
        if (chunkSize <= 0) {
            throw new Error(`chunkSize 必须为正整数 (chunkSize: ${chunkSize})`);
        }
        if (arr.length === 0) return [];

        const chunks: number[][] = [];
        for (let i = 0; i < arr.length; i += chunkSize) {
            chunks.push(arr.slice(i, i + chunkSize));
        }
        return chunks;
    }

    private async buildApiRoutePathMapByIds(apiIds: number[]): Promise<Map<number, string>> {
        const uniqueIds = Array.from(new Set(apiIds));
        if (uniqueIds.length === 0) {
            return new Map();
        }

        const apiMap = new Map<number, string>();
        const chunks = this.chunkNumberArray(uniqueIds, CacheHelper.API_ID_IN_CHUNK_SIZE);

        for (const chunk of chunks) {
            const apis = await this.db.getAll({
                table: "addon_admin_api",
                fields: ["id", "routePath"],
                where: {
                    id$in: chunk
                }
            });

            for (const api of apis.lists) {
                apiMap.set(api.id, api.routePath);
            }
        }

        return apiMap;
    }

    /**
     * 缓存所有接口到 Redis
     */
    async cacheApis(): Promise<void> {
        try {
            // 检查表是否存在
            const tableExists = await this.db.tableExists("addon_admin_api");
            if (!tableExists) {
                Logger.warn("⚠️ 接口表不存在，跳过接口缓存");
                return;
            }

            // 从数据库查询所有接口
            const apiList = await this.db.getAll({
                table: "addon_admin_api"
            });

            // 缓存到 Redis
            const result = await this.redis.setObject(CacheKeys.apisAll(), apiList.lists);

            if (result === null) {
                Logger.warn("⚠️ 接口缓存失败");
            }
        } catch (error: any) {
            Logger.error({ err: error }, "⚠️ 接口缓存异常");
        }
    }

    /**
     * 缓存所有菜单到 Redis（从数据库读取）
     */
    async cacheMenus(): Promise<void> {
        try {
            // 检查表是否存在
            const tableExists = await this.db.tableExists("addon_admin_menu");
            if (!tableExists) {
                Logger.warn("⚠️ 菜单表不存在，跳过菜单缓存");
                return;
            }

            // 从数据库查询所有菜单
            const menus = await this.db.getAll({
                table: "addon_admin_menu"
            });

            // 缓存到 Redis
            const result = await this.redis.setObject(CacheKeys.menusAll(), menus.lists);

            if (result === null) {
                Logger.warn("⚠️ 菜单缓存失败");
            }
        } catch (error: any) {
            Logger.warn({ err: error }, "⚠️ 菜单缓存异常");
        }
    }

    /**
     * 缓存所有角色的接口权限到 Redis
     * 全量重建：清理所有角色权限缓存并重建
     * - 极简方案：每个角色一个 Set，直接覆盖更新（DEL + SADD）
     */
    async rebuildRoleApiPermissions(): Promise<void> {
        try {
            // 检查表是否存在
            const apiTableExists = await this.db.tableExists("addon_admin_api");
            const roleTableExists = await this.db.tableExists("addon_admin_role");

            if (!apiTableExists || !roleTableExists) {
                Logger.warn("⚠️ 接口或角色表不存在，跳过角色权限缓存");
                return;
            }

            // 查询所有角色（仅取必要字段）
            const roles = await this.db.getAll({
                table: "addon_admin_role",
                fields: ["code", "apis"]
            });

            const roleApiIdsMap = new Map<string, number[]>();
            const allApiIdsSet = new Set<number>();

            for (const role of roles.lists) {
                if (!role?.code) continue;
                const apiIds = this.normalizeNumberIdList(role.apis);
                roleApiIdsMap.set(role.code, apiIds);
                for (const id of apiIds) {
                    allApiIdsSet.add(id);
                }
            }

            const roleCodes = Array.from(roleApiIdsMap.keys());
            if (roleCodes.length === 0) {
                Logger.info("✅ 没有需要缓存的角色权限");
                return;
            }

            // 构建所有需要的 API 映射（按 ID 分块使用 $in，避免全表扫描/避免超长 IN）
            const allApiIds = Array.from(allApiIdsSet);
            const apiMap = await this.buildApiRoutePathMapByIds(allApiIds);

            // 清理所有角色的缓存 key（保证幂等）
            const roleKeys = roleCodes.map((code) => CacheKeys.roleApis(code));
            await this.redis.delBatch(roleKeys);

            // 批量写入新缓存（只写入非空权限）
            const items: Array<{ key: string; members: string[] }> = [];

            for (const roleCode of roleCodes) {
                const apiIds = roleApiIdsMap.get(roleCode) || [];
                const membersSet = new Set<string>();

                for (const id of apiIds) {
                    const apiPath = apiMap.get(id);
                    if (apiPath) {
                        membersSet.add(apiPath);
                    }
                }

                const members = Array.from(membersSet).sort();

                if (members.length > 0) {
                    items.push({ key: CacheKeys.roleApis(roleCode), members: members });
                }
            }

            if (items.length > 0) {
                await this.redis.saddBatch(items);
            }

            // 极简方案不做版本/ready/meta：重建完成即生效
        } catch (error: any) {
            Logger.error({ err: error }, "⚠️ 角色权限缓存异常（将阻断启动）");
            throw error;
        }
    }

    /**
     * 增量刷新单个角色的接口权限缓存
     * - apiIds 为空数组：仅清理缓存（防止残留）
     * - apiIds 非空：使用 $in 最小查询，DEL 后 SADD
     */
    async refreshRoleApiPermissions(roleCode: string, apiIds: number[]): Promise<void> {
        if (!roleCode || typeof roleCode !== "string") {
            throw new Error("roleCode 必须是非空字符串");
        }
        const normalizedIds = this.normalizeNumberIdList(apiIds);
        const roleKey = CacheKeys.roleApis(roleCode);

        // 空数组短路：避免触发 $in 空数组异常，同时保证清理残留
        if (normalizedIds.length === 0) {
            await this.redis.del(roleKey);
            return;
        }

        const apiMap = await this.buildApiRoutePathMapByIds(normalizedIds);
        const membersSet = new Set<string>();
        for (const id of normalizedIds) {
            const apiPath = apiMap.get(id);
            if (apiPath) {
                membersSet.add(apiPath);
            }
        }

        const members = Array.from(membersSet);

        await this.redis.del(roleKey);
        if (members.length > 0) {
            await this.redis.sadd(roleKey, members);
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
        await this.rebuildRoleApiPermissions();
    }

    /**
     * 获取缓存的所有接口
     * @returns 接口列表
     */
    async getApis(): Promise<any[]> {
        try {
            const apis = await this.redis.getObject<any[]>(CacheKeys.apisAll());
            return apis || [];
        } catch (error: any) {
            Logger.error({ err: error }, "获取接口缓存失败");
            return [];
        }
    }

    /**
     * 获取缓存的所有菜单
     * @returns 菜单列表
     */
    async getMenus(): Promise<any[]> {
        try {
            const menus = await this.redis.getObject<any[]>(CacheKeys.menusAll());
            return menus || [];
        } catch (error: any) {
            Logger.error({ err: error }, "获取菜单缓存失败");
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
            const permissions = await this.redis.smembers(CacheKeys.roleApis(roleCode));
            return permissions || [];
        } catch (error: any) {
            Logger.error({ err: error, roleCode: roleCode }, "获取角色权限缓存失败");
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
            return await this.redis.sismember(CacheKeys.roleApis(roleCode), apiPath);
        } catch (error: any) {
            Logger.error({ err: error, roleCode: roleCode }, "检查角色权限失败");
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
            const result = await this.redis.del(CacheKeys.roleApis(roleCode));
            if (result > 0) {
                Logger.info(`✅ 已删除角色 ${roleCode} 的权限缓存`);
                return true;
            }
            return false;
        } catch (error: any) {
            Logger.error({ err: error, roleCode: roleCode }, "删除角色权限缓存失败");
            return false;
        }
    }
}
