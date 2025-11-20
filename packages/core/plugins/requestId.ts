import type { Plugin } from '../types/plugin.js';

const plugin: Plugin = {
    pluginName: 'requestId',
    after: ['errorHandler'],
    onRequest: async (befly, ctx, next) => {
        // 生成唯一请求 ID
        const requestId = crypto.randomUUID();
        ctx.requestId = requestId;

        // 添加到 CORS 响应头
        if (!ctx.corsHeaders) {
            ctx.corsHeaders = {};
        }
        ctx.corsHeaders['X-Request-ID'] = requestId;

        await next();
    }
};
export default plugin;
