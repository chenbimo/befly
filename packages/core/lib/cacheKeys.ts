/**
 * Cache Key 统一管理
 * 所有缓存键在此统一定义，避免硬编码分散
 */

/**
 * Cache Key 生成函数集合
 */
export class CacheKeys {
    /** 所有接口缓存2 */
    static apisAll(): string {
        return "apis:all";
    }

    /** 所有菜单缓存 */
    static menusAll(): string {
        return "menus:all";
    }

    /** 角色信息缓存（完整角色对象） */
    static roleInfo(roleCode: string): string {
        return `role:info:${roleCode}`;
    }

    /**
     * 角色接口权限缓存（Set 集合）
     * - key: role:apis:${roleCode}
     * - member: url.pathname（例如 /api/user/login；与 method 无关）
     */
    static roleApis(roleCode: string): string {
        return `role:apis:${roleCode}`;
    }
}
