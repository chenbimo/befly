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

    constructor(deps: CacheHelperDeps) {
        this.db = deps.db;
        this.redis = deps.redis;
    }

    private normalizeApiPathname(value: unknown): string {
        if (typeof value !== "string") return "";
        const trimmed = value.trim();
        if (!trimmed) return "";

        // 允许存入/传入 "POST/api/xxx" 或 "POST /api/xxx"，统一转为 "/api/xxx"
        const methodMatch = trimmed.match(/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*(.*)$/i);
        if (methodMatch) {
            const rest = String(methodMatch[2] || "").trim();
            if (!rest) return "";
            if (rest.startsWith("/")) return rest;
            if (rest.startsWith("api/")) return `/${rest}`;
            return rest.includes("/") ? `/${rest}` : rest;
        }

        if (trimmed.startsWith("/")) return trimmed;
        if (trimmed.startsWith("api/")) return `/${trimmed}`;
        return trimmed.includes("/") ? `/${trimmed}` : trimmed;
    }

    private normalizeApiPathList(value: unknown): string[] {
        if (value === null || value === undefined) return [];

        const normalizeSingle = (item: unknown): string | null => {
            const p = this.normalizeApiPathname(item);
            return p ? p : null;
        };

        if (Array.isArray(value)) {
            const out: string[] = [];
            for (const item of value) {
                const p = normalizeSingle(item);
                if (p !== null) out.push(p);
            }
            return out;
        }

        if (typeof value === "string") {
            const str = value.trim();
            if (!str) return [];

            if (str.startsWith("[")) {
                try {
                    const parsed = JSON.parse(str);
                    return this.normalizeApiPathList(parsed);
                } catch {
                    // ignore
                }
            }

            const single = normalizeSingle(str);
            return single === null ? [] : [single];
        }

        const single = normalizeSingle(value);
        return single === null ? [] : [single];
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
            const roleTableExists = await this.db.tableExists("addon_admin_role");

            if (!roleTableExists) {
                Logger.warn("⚠️ 角色表不存在，跳过角色权限缓存");
                return;
            }

            // 查询所有角色（仅取必要字段）
            const roles = await this.db.getAll({
                table: "addon_admin_role",
                fields: ["code", "apis"]
            });

            const roleApiPathsMap = new Map<string, string[]>();

            for (const role of roles.lists) {
                if (!role?.code) continue;
                const apiPaths = this.normalizeApiPathList(role.apis);
                roleApiPathsMap.set(role.code, apiPaths);
            }

            const roleCodes = Array.from(roleApiPathsMap.keys());
            if (roleCodes.length === 0) {
                Logger.info("✅ 没有需要缓存的角色权限");
                return;
            }

            // 清理所有角色的缓存 key（保证幂等）
            const roleKeys = roleCodes.map((code) => CacheKeys.roleApis(code));
            await this.redis.delBatch(roleKeys);

            // 批量写入新缓存（只写入非空权限）
            const items: Array<{ key: string; members: string[] }> = [];

            for (const roleCode of roleCodes) {
                const apiPaths = roleApiPathsMap.get(roleCode) || [];
                const members = Array.from(new Set(apiPaths.map((p) => this.normalizeApiPathname(p)).filter((p) => p.length > 0))).sort();

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
    async refreshRoleApiPermissions(roleCode: string, apiPaths: string[]): Promise<void> {
        if (!roleCode || typeof roleCode !== "string") {
            throw new Error("roleCode 必须是非空字符串");
        }
        const normalizedPaths = this.normalizeApiPathList(apiPaths);
        const roleKey = CacheKeys.roleApis(roleCode);

        // 空数组短路：保证清理残留
        if (normalizedPaths.length === 0) {
            await this.redis.del(roleKey);
            return;
        }

        const members = Array.from(new Set(normalizedPaths.map((p) => this.normalizeApiPathname(p)).filter((p) => p.length > 0)));

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
     * @param apiPath - 接口路径（url.pathname，例如 /api/user/login；与 method 无关）
     * @returns 是否有权限
     */
    async checkRolePermission(roleCode: string, apiPath: string): Promise<boolean> {
        try {
            const normalizedPath = this.normalizeApiPathname(apiPath);
            return await this.redis.sismember(CacheKeys.roleApis(roleCode), normalizedPath);
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
