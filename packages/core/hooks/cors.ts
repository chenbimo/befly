import type { CorsConfig } from "../types/befly";
// 类型导入
import type { Hook } from "../types/hook";

// 相对导入
import { setCorsOptions } from "../utils/cors";

/**
 * CORS 跨域处理钩子
 * 设置跨域响应头并处理 OPTIONS 预检请求
 */
export default {
    name: "cors",
    deps: [],
    handler: async (befly, ctx) => {
        const req = ctx.req;

        // 合并默认配置和用户配置
        const defaultConfig: CorsConfig = {
            origin: "*",
            methods: "GET, POST, PUT, DELETE, OPTIONS",
            allowedHeaders: "Content-Type, Authorization, authorization, token",
            exposedHeaders: "Content-Range, X-Content-Range, Authorization, authorization, token",
            maxAge: 86400,
            credentials: "true"
        };

        const corsConfig = Object.assign({}, defaultConfig, befly.config && befly.config.cors ? befly.config.cors : {});

        // 设置 CORS 响应头
        const headers = setCorsOptions(req, corsConfig);

        ctx.corsHeaders = headers;

        // 处理 OPTIONS 预检请求
        if (req.method === "OPTIONS") {
            ctx.response = new Response(null, {
                status: 204,
                headers: headers
            });
            return;
        }
    }
} satisfies Hook;
