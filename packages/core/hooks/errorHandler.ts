import type { Hook } from '../types/hook.js';
import { Logger } from '../lib/logger.js';

const hook: Hook = {
    handler: async (befly, ctx, next) => {
        try {
            await next();
        } catch (err: any) {
            // 记录错误信息
            const apiPath = ctx.api ? `${ctx.req.method}${new URL(ctx.req.url).pathname}` : ctx.req.url;
            Logger.error(`Request Error: ${apiPath}`, err);

            // 设置错误响应
            ctx.response = Response.json(
                { code: 1, msg: 'Internal Server Error' },
                {
                    headers: ctx.corsHeaders,
                    status: 500
                }
            );
        }
    }
};
export default hook;
