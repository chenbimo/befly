/**
 * 缓存助手 - TypeScript 版本
 * 负责在服务器启动时缓存接口、菜单和角色权限到 Redis
 */

import { CacheKeys } from "./cacheKeys";
import { Logger } from "./logger";

type CacheHelperDb = {
    tableExists(table: string): Promise<{ data: boolean }>;
    getAll(options: any): Promise<{ data: { lists: any[] } }>;
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

    private assertApiPathname(value: unknown, errorPrefix: string): string {
        if (typeof value !== "string") {
            throw new Error(`${errorPrefix} 必须是字符串`);
        }

        const trimmed = value.trim();
        if (!trimmed) {
            throw new Error(`${errorPrefix} 不允许为空字符串`);
        }

        if (/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/i.test(trimmed)) {
            throw new Error(`${errorPrefix} 不允许包含 method 前缀，应为 url.pathname（例如 /api/app/xxx）`);
        }

        if (!trimmed.startsWith("/")) {
            throw new Error(`${errorPrefix} 必须是 pathname（以 / 开头）`);
        }

        if (trimmed.includes(" ")) {
            throw new Error(`${errorPrefix} 不允许包含空格`);
        }

        return trimmed;
    }

    private assertApiPathList(value: unknown, roleCode: string): string[] {
        if (value === null || value === undefined) return [];

        let list: unknown = value;

        // 兼容历史/手工数据：apis 可能被存成 JSON 字符串或 "null"
        if (typeof list === "string") {
            const trimmed = list.trim();

            // TEXT 字段常见历史值："null"（表示空）
            if (trimmed === "" || trimmed === "null") {
                return [];
            }

            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                try {
                    list = JSON.parse(trimmed);
                } catch {
                    throw new Error(`角色权限数据不合法：addon_admin_role.apis JSON 解析失败，roleCode=${roleCode}`);
                }
            }
        }

        if (!Array.isArray(list)) {
            const typeLabel = typeof list;
            throw new Error(`角色权限数据不合法：addon_admin_role.apis 必须是字符串数组或 JSON 数组字符串，roleCode=${roleCode}，type=${typeLabel}`);
        }

        const out: string[] = [];
        for (const item of list) {
            out.push(this.assertApiPathname(item, `角色权限数据不合法：addon_admin_role.apis 元素，roleCode=${roleCode}`));
        }

        return out;
    }

    /**
     * 缓存所有接口到 Redis
     */
    async cacheApis(): Promise<void> {
        try {
            // 检查表是否存在
            const tableExists = await this.db.tableExists("addon_admin_api");
            if (!tableExists.data) {
                Logger.warn("⚠️ 接口表不存在，跳过接口缓存");
                return;
            }

            // 从数据库查询所有接口
            const apiList = await this.db.getAll({
                table: "addon_admin_api"
            });

            // 缓存到 Redis
            const result = await this.redis.setObject(CacheKeys.apisAll(), apiList.data.lists);

            if (result === null) {
                Logger.warn("⚠️ 接口缓存失败");
            }
        } catch (error: any) {
            Logger.error({ err: error, msg: "⚠️ 接口缓存异常" });
        }
    }

    /**
     * 缓存所有菜单到 Redis（从数据库读取）
     */
    async cacheMenus(): Promise<void> {
        try {
            // 检查表是否存在
            const tableExists = await this.db.tableExists("addon_admin_menu");
            if (!tableExists.data) {
                Logger.warn("⚠️ 菜单表不存在，跳过菜单缓存");
                return;
            }

            // 从数据库查询所有菜单
            const menus = await this.db.getAll({
                table: "addon_admin_menu"
            });

            // 缓存到 Redis
            const result = await this.redis.setObject(CacheKeys.menusAll(), menus.data.lists);

            if (result === null) {
                Logger.warn("⚠️ 菜单缓存失败");
            }
        } catch (error: any) {
            Logger.warn({ err: error, msg: "⚠️ 菜单缓存异常" });
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

            if (!roleTableExists.data) {
                Logger.warn("⚠️ 角色表不存在，跳过角色权限缓存");
                return;
            }

            // 查询所有角色（仅取必要字段）
            const roles = await this.db.getAll({
                table: "addon_admin_role",
                fields: ["code", "apis"]
            });

            const roleApiPathsMap = new Map<string, string[]>();

            for (const role of roles.data.lists) {
                if (!role?.code) continue;
                const apiPaths = this.assertApiPathList(role.apis, role.code);
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
                const members = Array.from(new Set(apiPaths)).sort();

                if (members.length > 0) {
                    items.push({ key: CacheKeys.roleApis(roleCode), members: members });
                }
            }

            if (items.length > 0) {
                await this.redis.saddBatch(items);
            }

            // 极简方案不做版本/ready/meta：重建完成即生效
        } catch (error: any) {
            Logger.error({ err: error, msg: "⚠️ 角色权限缓存异常（将阻断启动）" });
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
        if (!Array.isArray(apiPaths)) {
            throw new Error("apiPaths 必须是数组");
        }

        const normalizedPaths = apiPaths.map((p) => this.assertApiPathname(p, `refreshRoleApiPermissions: apiPaths 元素，roleCode=${roleCode}`));
        const roleKey = CacheKeys.roleApis(roleCode);

        // 空数组短路：保证清理残留
        if (normalizedPaths.length === 0) {
            await this.redis.del(roleKey);
            return;
        }

        const members = Array.from(new Set(normalizedPaths));

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
            Logger.error({ err: error, msg: "获取接口缓存失败" });
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
            Logger.error({ err: error, msg: "获取菜单缓存失败" });
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
            Logger.error({ err: error, roleCode: roleCode, msg: "获取角色权限缓存失败" });
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
            const pathname = this.assertApiPathname(apiPath, "checkRolePermission: apiPath");
            return await this.redis.sismember(CacheKeys.roleApis(roleCode), pathname);
        } catch (error: any) {
            Logger.error({ err: error, roleCode: roleCode, msg: "检查角色权限失败" });
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
            Logger.error({ err: error, roleCode: roleCode, msg: "删除角色权限缓存失败" });
            return false;
        }
    }
}
