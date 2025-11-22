import type { Hook } from '../types/hook.js';
import { setCorsOptions } from '../lib/middleware.js';

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
        // this.config 会包含默认值和用户传入的配置（如果 loadPlugins 正确合并了的话）
        // loadPlugins 目前是直接覆盖 plugin.config。
        // 所以我们需要手动合并，或者依赖 loadPlugins 的行为。
        // 这里的 plugin 对象是单例，this.config 在 loadPlugins 中被赋值。
        // 如果用户没传，this.config 就是上面的默认值。
        // 如果用户传了，this.config 就是用户的配置。
        // 为了支持部分覆盖，我们需要在 onInit 中做合并，或者在这里做合并。
        // 简单起见，我们在 onRequest 中合并。

        // 注意：由于 plugin 对象是导出的对象，this 指向它。
        // 但是 loadPlugins 中是 plugin.config = pluginsConfig[pluginName]。
        // 这会覆盖掉上面的 config 属性。
        // 所以我们应该在 onInit 中处理合并，或者不定义默认 config 属性，而是写在代码里。

        // 更好的做法：
        const defaultConfig = {
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
        const corsResult = setCorsOptions(req, config);
        const headers = corsResult.headers;

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
