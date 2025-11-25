// 相对导入
import { Logger } from '../lib/logger.js';

// 类型导入
import type { Hook } from '../types/hook.js';

/**
 * 请求日志记录钩子
 * 记录请求方法、路径、用户信息和响应时间
 */
const hook: Hook = {
    after: ['parser'],
    order: 30,
    handler: async (befly, ctx, next) => {
        await next();

        if (ctx.api) {
            const apiPath = `${ctx.req.method}${new URL(ctx.req.url).pathname}`;
            const duration = Date.now() - ctx.now;
            const user = ctx.user?.userId ? `[User:${ctx.user.userId}]` : '[Guest]';
            Logger.info(`[${ctx.req.method}] ${apiPath} ${user} ${duration}ms`);
        }
    }
};
export default hook;
