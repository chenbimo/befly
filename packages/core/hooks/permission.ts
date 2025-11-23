import type { Hook } from '../types/hook.js';
import type { ApiRoute } from '../types/api.js';
import type { RequestContext } from '../types/context.js';

/**
 * 检查用户权限
 */
function checkPermission(api: ApiRoute, ctx: RequestContext, hasPermission: boolean) {
    // 1. 接口无需权限
    if (api.auth === false) {
        return { code: 0, msg: '无需权限' };
    }

    // 2. 用户未登录
    if (!ctx.user || !ctx.user.userId) {
        return { code: 401, msg: '未登录', data: null };
    }

    // 3. 开发者权限（最高权限）
    if (ctx.user.roleCode === 'dev') {
        return { code: 0, msg: '开发者权限' };
    }

    // 4. 角色权限检查
    if (hasPermission) {
        return { code: 0, msg: '有权限' };
    }

    return { code: 403, msg: '无权访问', data: null };
}

const hook: Hook = {
    after: ['auth'],
    handler: async (befly, ctx, next) => {
        if (!ctx.api) return next();

        let hasPermission = false;
        if (ctx.api.auth === true && ctx.user?.roleCode && ctx.user.roleCode !== 'dev') {
            const apiPath = `${ctx.request.method}${new URL(ctx.request.url).pathname}`;
            const roleApisKey = `role:apis:${ctx.user.roleCode}`;
            if (befly.redis) {
                const isMember = await befly.redis.sismember(roleApisKey, apiPath);
                hasPermission = isMember === 1;
            }
        }

        const permissionResult = checkPermission(ctx.api, ctx, hasPermission);
        if (permissionResult.code !== 0) {
            ctx.response = Response.json(permissionResult, {
                headers: ctx.corsHeaders
            });
            return;
        }
        await next();
    }
};
export default hook;
