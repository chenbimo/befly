/**
 * Redis Key 统一管理
 * 所有 Redis 缓存键在此统一定义，避免硬编码分散
 */

/**
 * Redis Key 生成函数集合
 */
export const RedisKeys = {
    /** 所有接口缓存 */
    apisAll: () => 'befly:apis:all',

    /** 所有菜单缓存 */
    menusAll: () => 'befly:menus:all',

    /** 角色信息缓存（完整角色对象） */
    roleInfo: (roleCode: string) => `befly:role:info:${roleCode}`,

    /** 角色接口权限缓存（Set 集合） */
    roleApis: (roleCode: string) => `befly:role:apis:${roleCode}`,

    /** 表结构缓存 */
    tableColumns: (table: string) => `befly:table:columns:${table}`
} as const;

/**
 * Redis TTL（过期时间）常量配置（单位：秒）
 */
export const RedisTTL = {
    /** 表结构缓存 - 1小时 */
    tableColumns: 3600,

    /** 角色接口权限 - 24小时 */
    roleApis: 86400,

    /** 角色信息 - 24小时 */
    roleInfo: 86400,

    /** 接口列表 - 永久（不过期） */
    apisAll: null,

    /** 菜单列表 - 永久（不过期） */
    menusAll: null
} as const;
