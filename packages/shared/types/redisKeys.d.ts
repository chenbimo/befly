/**
 * Redis Key 统一管理
 * 所有 Redis 缓存键在此统一定义，避免硬编码分散
 */
/**
 * Redis Key 生成函数集合
 */
export declare const RedisKeys: {
    /** 所有接口缓存 */
    readonly apisAll: () => string;
    /** 所有菜单缓存 */
    readonly menusAll: () => string;
    /** 角色信息缓存（完整角色对象） */
    readonly roleInfo: (roleCode: string) => string;
    /** 角色接口权限缓存（Set 集合） */
    readonly roleApis: (roleCode: string) => string;
    /** 表结构缓存 */
    readonly tableColumns: (table: string) => string;
};
/**
 * Redis TTL（过期时间）常量配置（单位：秒）
 */
export declare const RedisTTL: {
    /** 表结构缓存 - 1小时 */
    readonly tableColumns: 3600;
    /** 角色接口权限 - 24小时 */
    readonly roleApis: 86400;
    /** 角色信息 - 24小时 */
    readonly roleInfo: 86400;
    /** 接口列表 - 永久（不过期） */
    readonly apisAll: null;
    /** 菜单列表 - 永久（不过期） */
    readonly menusAll: null;
};
