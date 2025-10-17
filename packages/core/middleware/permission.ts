/**
 * 权限验证中间件
 * 处理登录验证和角色权限检查
 */

import { isType } from '../utils/index.js';
import type { ApiRoute } from '../types/api.js';
import type { RequestContext } from '../types/context.js';

export interface PermissionResult {
    allowed: boolean;
    reason?: string;
    extra?: any;
}

/**
 * 检查权限
 * auth 有3种值:
 * - true: 需要登录
 * - string: 需要特定角色类型
 * - array: 需要在角色列表中
 *
 * 特殊规则：
 * - role='dev' 的用户拥有所有权限（超级管理员）
 */
export function checkPermission(api: ApiRoute, ctx: RequestContext): PermissionResult {
    // dev 角色拥有所有权限，直接通过（用 * 表示具备所有权限）
    if (ctx.user?.role === 'dev') {
        return { allowed: true };
    }

    // 登录验证
    if (api.auth === true && !ctx.user.id) {
        return {
            allowed: false,
            reason: '未登录',
            extra: { login: 'no' }
        };
    }

    // 角色类型验证（字符串）
    if (isType(api.auth, 'string') && api.auth !== ctx.user?.role_type) {
        return {
            allowed: false,
            reason: '没有权限'
        };
    }

    // 角色列表验证（数组）
    if (isType(api.auth, 'array') && !api.auth.includes(ctx.user?.role)) {
        return {
            allowed: false,
            reason: '没有权限'
        };
    }

    return { allowed: true };
}
