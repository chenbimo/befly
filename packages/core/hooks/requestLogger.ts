// 相对导入
import { Logger } from '../lib/logger.js';

// 类型导入
import type { Hook } from '../types/hook.js';

/**
 * 请求日志记录中间件
 * 记录请求方法、路径、用户信息和响应时间
 */
const hook: Hook = {
    after: ['parser'],
    handler: async (befly, ctx, next) => {
        if (ctx.api) {
            const apiPath = `${ctx.request.method}${new URL(ctx.request.url).pathname}`;
            const duration = Date.now() - ctx.startTime;
            const user = ctx.user?.userId ? `[User:${ctx.user.userId}]` : '[Guest]';
            Logger.info(`[${ctx.request.method}] ${apiPath} ${user} ${duration}ms`);
        }
        await next();
    }
};
export default hook;
