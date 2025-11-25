// 相对导入
import { Logger } from '../lib/logger.js';
import { JsonResponse } from '../util.js';

// 类型导入
import type { Hook } from '../types/hook.js';

const hook: Hook = {
    order: 1,
    handler: async (befly, ctx, next) => {
        try {
            await next();
        } catch (err: any) {
            // 记录错误信息
            const apiPath = ctx.api ? `${ctx.req.method}${new URL(ctx.req.url).pathname}` : ctx.req.url;
            Logger.error(`Request Error: ${apiPath}`, err);

            // 设置错误响应
            ctx.response = JsonResponse(ctx, '内部服务错误');
        }
    }
};
export default hook;
