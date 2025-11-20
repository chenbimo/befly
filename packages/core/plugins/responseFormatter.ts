import type { Plugin } from '../types/plugin.js';
import { No } from '../response.js';

const plugin: Plugin = {
    pluginName: 'responseFormatter',
    after: ['requestId'],
    onRequest: async (befly, ctx, next) => {
        await next();

        // 如果已经有 response，直接返回
        if (ctx.response) {
            return;
        }

        // 如果有 result，格式化为 JSON 响应
        if (ctx.result !== undefined) {
            const result = ctx.result;

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

        // 如果既没有 response 也没有 result，且不是 OPTIONS 请求，则返回 404
        // (OPTIONS 请求通常由 cors 插件处理并返回 204)
        if (ctx.request.method !== 'OPTIONS' && !ctx.response) {
            ctx.response = Response.json(No('No response generated'), {
                headers: ctx.corsHeaders
            });
        }
    }
};
export default plugin;
