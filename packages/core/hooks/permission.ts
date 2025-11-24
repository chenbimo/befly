// 类型导入
import type { Hook } from '../types/hook.js';

/**
 * 权限检查中间件
 * - 接口无需权限（auth=false）：直接通过
 * - 用户未登录：返回 401
 * - 开发者角色（dev）：最高权限，直接通过
 * - 其他角色：检查 Redis 中的角色权限集合
 */
const hook: Hook = {
    after: ['auth'],
    handler: async (befly, ctx, next) => {
        if (!ctx.api) return next();

        // 1. 接口无需权限
        if (ctx.api.auth === false) {
            return next();
        }

        // 2. 用户未登录
        if (!ctx.user || !ctx.user.userId) {
            ctx.response = Response.json({ code: 401, msg: '未登录', data: null }, { headers: ctx.corsHeaders });
            return;
        }

        // 3. 开发者权限（最高权限）
        if (ctx.user.roleCode === 'dev') {
            return next();
        }

        // 4. 角色权限检查
        let hasPermission = false;
        if (ctx.user.roleCode && befly.redis) {
        } else {
            // 验证角色权限
            const apiPath = `${ctx.req.method}${new URL(ctx.req.url).pathname}`;
            const roleApisKey = `role:apis:${ctx.user.roleCode}`;
            const isMember = await befly.redis.sismember(roleApisKey, apiPath);
            hasPermission = isMember === 1;
        }

        if (!hasPermission) {
            ctx.response = Response.json({ code: 403, msg: '无权访问', data: null }, { headers: ctx.corsHeaders });
            return;
        }

        await next();
    }
};
export default hook;
