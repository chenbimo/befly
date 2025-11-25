// 相对导入
import { JsonResponse } from '../util.js';
import { Logger } from '../lib/logger.js';

// 类型导入
import type { Hook } from '../types/hook.js';

const hook: Hook = {
    order: 99,
    handler: async (befly, ctx) => {
        // 记录请求日志（在最后格式化之前）
        if (ctx.api && ctx.requestId) {
            const apiPath = `${ctx.req.method}${new URL(ctx.req.url).pathname}`;
            const duration = Date.now() - ctx.now;
            const user = ctx.user?.userId ? `[User:${ctx.user.userId}]` : '[Guest]';
            Logger.info(`[${ctx.requestId}] ${apiPath} ${user} ${duration}ms`);
        }

        // 如果已经有 response，直接返回
        if (ctx.response) {
            return;
        }

        // 如果有 result，格式化为 JSON 响应
        if (ctx.result !== undefined) {
            let result = ctx.result;

            // 1. 如果是字符串，自动包裹为成功响应
            if (typeof result === 'string') {
                result = {
                    code: 0,
                    msg: result,
                    data: {}
                };
            }
            // 2. 如果是对象，自动补充 code: 0
            else if (result && typeof result === 'object') {
                if (!('code' in result)) {
                    result = {
                        code: 0,
                        ...result
                    };
                }
            }

            // 处理 BigInt 序列化问题
            if (result && typeof result === 'object') {
                const jsonString = JSON.stringify(result, (key, value) => (typeof value === 'bigint' ? value.toString() : value));
                ctx.response = new Response(jsonString, {
                    headers: {
                        ...ctx.corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            } else {
                // 简单类型直接返回
                ctx.response = Response.json(result, {
                    headers: ctx.corsHeaders
                });
            }
            return;
        }

        // 如果还没有响应，且不是 OPTIONS 请求，则设置默认 JSON 响应
        if (ctx.req.method !== 'OPTIONS' && !ctx.response) {
            ctx.response = JsonResponse(ctx, 'No response generated');
        }
    }
};
export default hook;
