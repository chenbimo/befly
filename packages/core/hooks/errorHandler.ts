import type { Hook } from '../types/hook.js';
import { Logger } from '../lib/logger.js';
import { No } from '../response.js';

const hook: Hook = {
    name: 'errorHandler',
    handler: async (befly, ctx, next) => {
        try {
            await next();
        } catch (err: any) {
            // 记录错误日志
            const apiPath = ctx.api ? `${ctx.request.method}${new URL(ctx.request.url).pathname}` : ctx.request.url;
            Logger.error(`Request Error: ${apiPath}`, err);

            // 设置错误响应
            ctx.response = Response.json(No('Internal Server Error'), {
                headers: ctx.corsHeaders,
                status: 500
            });
        }
    }
};
export default hook;
