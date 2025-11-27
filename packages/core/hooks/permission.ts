// 相对导入
import { ErrorResponse } from '../util.js';

// 类型导入
import type { Hook } from '../types/hook.js';

/**
 * 权限检查钩子
 * - 接口无需权限（auth=false）：直接通过
 * - 用户未登录：返回 401
 * - 开发者角色（dev）：最高权限，直接通过
 * - 其他角色：检查 Redis 中的角色权限集合
 */
const hook: Hook = {
    order: 6,
    handler: async (befly, ctx) => {
        if (!ctx.api) return;

        // 1. 接口无需权限
        if (ctx.api.auth === false) {
            return;
        }

        // 2. 用户未登录
        if (!ctx.user || !ctx.user.userId) {
            ctx.response = ErrorResponse(ctx, '未登录');
            return;
        }

        // 3. 开发者权限（最高权限）
        if (ctx.user.roleCode === 'dev') {
            return;
        }

        // 4. 角色权限检查
        let hasPermission = false;
        if (ctx.user.roleCode && befly.redis) {
            // 验证角色权限
            const apiPath = `${ctx.req.method}${new URL(ctx.req.url).pathname}`;
            const roleApisKey = `role:apis:${ctx.user.roleCode}`;
            const isMember = await befly.redis.sismember(roleApisKey, apiPath);
            hasPermission = isMember === 1;
        }

        if (!hasPermission) {
            ctx.response = ErrorResponse(ctx, '无权访问');
            return;
        }
    }
};
export default hook;
