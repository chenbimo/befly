import type { Hook } from '../types/hook.js';
import { Logger } from '../lib/logger.js';
import type { RequestContext } from '../types/context.js';

/**
 * 记录请求日志
 */
function logRequest(apiPath: string, ctx: RequestContext): void {
    const duration = Date.now() - ctx.startTime;
    const user = ctx.user?.userId ? `[User:${ctx.user.userId}]` : '[Guest]';
    Logger.info(`[${ctx.request.method}] ${apiPath} ${user} ${duration}ms`);
}

const hook: Hook = {
    after: ['parser'],
    handler: async (befly, ctx, next) => {
        if (ctx.api) {
            const apiPath = `${ctx.request.method}${new URL(ctx.request.url).pathname}`;
            logRequest(apiPath, ctx);
        }
        await next();
    }
};
export default hook;
