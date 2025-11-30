/**
 * 菜单权限相关类型定义
 */

/**
 * 菜单项类型
 */
export interface MenuItem {
    /** 菜单 ID */
    id: number;
    /** 父级 ID */
    pid: number;
    /** 菜单名称 */
    name: string;
    /** 菜单路径 */
    path: string;
    /** 菜单图标 */
    icon?: string;
    /** 排序 */
    sort: number;
    /** 是否隐藏 */
    hidden?: boolean;
    /** 子菜单 */
    children?: MenuItem[];
}

/**
 * 权限项类型
 */
export interface PermissionItem {
    /** API 路由（如 POST/api/user/list） */
    route: string;
    /** 权限名称 */
    name: string;
}

/**
 * 角色信息类型
 */
export interface RoleInfo {
    /** 角色 ID */
    id: number;
    /** 角色代码 */
    code: string;
    /** 角色名称 */
    name: string;
    /** 角色描述 */
    desc?: string;
}
