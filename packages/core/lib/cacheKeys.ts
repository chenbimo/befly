/**
 * Cache Key 统一管理
 * 所有缓存键在此统一定义，避免硬编码分散
 */

/**
 * Cache Key 生成函数集合
 */
export class CacheKeys {
    /** 所有接口缓存 */
    static apisAll(): string {
        return "befly:apis:all";
    }

    /** 所有菜单缓存 */
    static menusAll(): string {
        return "befly:menus:all";
    }

    /** 角色信息缓存（完整角色对象） */
    static roleInfo(roleCode: string): string {
        return `befly:role:info:${roleCode}`;
    }

    /**
     * 角色接口权限缓存（Set 集合）
     * - key: befly:role:apis:${roleCode}
     * - member: url.pathname（例如 /api/user/login；与 method 无关）
     */
    static roleApis(roleCode: string): string {
        return `befly:role:apis:${roleCode}`;
    }

    /** 表结构缓存 */
    static tableColumns(table: string): string {
        return `befly:table:columns:${table}`;
    }
}
