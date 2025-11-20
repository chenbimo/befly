import type { Plugin } from '../types/plugin.js';
import { Env } from '../env.js';

const plugin: Plugin = {
    pluginName: 'cors',
    after: ['errorHandler'],
    config: {
        allowOrigin: Env.CORS_ALLOWED_ORIGIN,
        allowMethods: Env.CORS_ALLOWED_METHODS,
        allowHeaders: Env.CORS_ALLOWED_HEADERS,
        exposeHeaders: Env.CORS_EXPOSE_HEADERS,
        maxAge: Env.CORS_MAX_AGE || 86400,
        allowCredentials: Env.CORS_ALLOW_CREDENTIALS || 'true'
    },
    onRequest: async (befly, ctx, next) => {
        const req = ctx.request;
        const config = plugin.config || {};

        // 设置 CORS 响应头
        const headers: Record<string, string> = {
            'Access-Control-Allow-Origin': config.allowOrigin === '*' ? req.headers.get('origin') || '*' : config.allowOrigin,
            'Access-Control-Allow-Methods': config.allowMethods,
            'Access-Control-Allow-Headers': config.allowHeaders,
            'Access-Control-Expose-Headers': config.exposeHeaders,
            'Access-Control-Max-Age': String(config.maxAge),
            'Access-Control-Allow-Credentials': String(config.allowCredentials)
        };

        ctx.corsHeaders = headers;

        // 处理 OPTIONS 预检请求
        if (req.method === 'OPTIONS') {
            ctx.response = new Response(null, {
                status: 204,
                headers: headers
            });
            return;
        }

        await next();
    }
};
export default plugin;
