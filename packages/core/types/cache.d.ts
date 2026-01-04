/**
 * 缓存助手类型定义
 */

import type { BeflyContext } from "./befly.ts";

/**
 * 缓存助手类
 * 负责在服务器启动时缓存接口、菜单和角色权限到 Redis
 */
export interface CacheHelper {
    /**
     * 缓存所有接口到 Redis
     */
    cacheApis(): Promise<void>;

    /**
     * 缓存所有菜单到 Redis（从数据库读取）
     */
    cacheMenus(): Promise<void>;

    /**
     * 全量重建所有角色的接口权限缓存
     */
    rebuildRoleApiPermissions(): Promise<void>;

    /**
     * 增量刷新单个角色的接口权限缓存
     */
    refreshRoleApiPermissions(roleCode: string, apiPaths: string[]): Promise<void>;

    /**
     * 缓存所有数据（接口、菜单、角色权限）
     */
    cacheAll(): Promise<void>;

    /**
     * 获取缓存的所有接口
     * @returns 接口列表
     */
    getApis(): Promise<any[]>;

    /**
     * 获取缓存的所有菜单
     * @returns 菜单列表
     */
    getMenus(): Promise<any[]>;

    /**
     * 获取角色的接口权限
     * @param roleCode - 角色代码
     * @returns 接口路径列表
     */
    getRolePermissions(roleCode: string): Promise<string[]>;

    /**
     * 检查角色是否有指定接口权限
     * @param roleCode - 角色代码
        * @param apiPath - 接口路径（url.pathname，例如 /api/user/login；与 method 无关）
     * @returns 是否有权限
     */
    checkRolePermission(roleCode: string, apiPath: string): Promise<boolean>;

    /**
     * 删除角色的接口权限缓存
     * @param roleCode - 角色代码
     * @returns 是否删除成功
     */
    deleteRolePermissions(roleCode: string): Promise<boolean>;
}

/**
 * CacheHelper 构造函数类型
 */
export interface CacheHelperConstructor {
    new (befly: BeflyContext): CacheHelper;
}
