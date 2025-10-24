/**
 * 权限验证中间件
 * 处理登录验证和接口权限检查
 */

import { isType } from '../utils/index.js';
import type { ApiRoute } from '../types/api.js';
import type { RequestContext } from '../types/context.js';

export interface PermissionResult {
    code: 0 | 1;
    msg: string;
    data: any;
    [key: string]: any;
}

/**
 * 检查权限
 *
 * 验证流程:
 * 1. auth=false → 公开接口，直接通过
 * 2. auth=true → 需要登录认证
 *    - 未登录 → 拒绝
 *    - roleCode='dev' → 超级管理员，拥有所有权限
 *    - 其他角色 → 检查接口是否在角色的可访问接口列表中（通过 Redis SISMEMBER 预判断）
 *
 * @param api - API 路由配置
 * @param ctx - 请求上下文
 * @param hasPermission - 是否有权限（通过 Redis SISMEMBER 预先判断）
 * @returns 统一的响应格式 { code: 0/1, msg, data, ...extra }
 */
export function checkPermission(api: ApiRoute, ctx: RequestContext, hasPermission: boolean = false): PermissionResult {
    // 1. 公开接口（auth=false），无需验证
    if (api.auth === false) {
        return { code: 0, msg: '', data: {} };
    }

    // 2. 需要登录的接口（auth=true）
    // 2.1 检查是否登录
    if (!ctx.user?.id) {
        return {
            code: 1,
            msg: '未登录',
            data: {},
            login: 'no'
        };
    }

    // 2.2 dev 角色拥有所有权限（超级管理员）
    if (ctx.user.roleCode === 'dev') {
        return { code: 0, msg: '', data: {} };
    }

    // 2.3 检查接口权限（基于 Redis SISMEMBER 预判断结果）
    if (!hasPermission) {
        return {
            code: 1,
            msg: '没有权限访问此接口',
            data: {}
        };
    }

    // 验证通过
    return { code: 0, msg: '', data: {} };
}
