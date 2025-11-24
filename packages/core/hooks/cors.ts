// 相对导入
import { setCorsOptions } from '../util.js';

// 类型导入
import type { Hook } from '../types/hook.js';
import type { CorsConfig } from '../types/befly.js';

/**
 * CORS 跨域处理中间件
 * 设置跨域响应头并处理 OPTIONS 预检请求
 */
const hook: Hook = {
    after: ['errorHandler'],
    // 默认配置
    config: {
        origin: '*',
        methods: 'GET, POST, PUT, DELETE, OPTIONS',
        allowedHeaders: 'Content-Type, Authorization, authorization, token',
        exposedHeaders: 'Content-Range, X-Content-Range, Authorization, authorization, token',
        maxAge: 86400,
        credentials: 'true'
    },
    handler: async (befly, ctx, next) => {
        const req = ctx.request;

        // 合并默认配置和用户配置
        const defaultConfig: CorsConfig = {
            origin: '*',
            methods: 'GET, POST, PUT, DELETE, OPTIONS',
            allowedHeaders: 'Content-Type, Authorization, authorization, token',
            exposedHeaders: 'Content-Range, X-Content-Range, Authorization, authorization, token',
            maxAge: 86400,
            credentials: 'true'
        };

        // @ts-ignore
        const userConfig = plugin.config || {};
        const config = { ...defaultConfig, ...userConfig };

        // 设置 CORS 响应头
        const headers = setCorsOptions(req, config);

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
export default hook;
