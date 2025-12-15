/**
 * 角色接口权限缓存（Redis）元信息类型
 *
 * 说明：
 * - active/ready 用于全局版本切换与就绪门槛
 * - role meta 用于单角色增量刷新后的可观测性
 */

export type RoleApisCacheMeta = {
    hash: string;
    at: number;
    roles: number;
    members: number;
    /** 可选：用于和 DB 侧的更新时间做一致性对比 */
    updatedAt?: number;
};

export type RoleApisRoleMeta = {
    roleCode: string;
    at: number;
    members: number;
    hash: string;
};
