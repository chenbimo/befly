/**
 * CORS 中间件
 * 处理跨域请求
 */

import { Env } from '../config/env.js';

export interface CorsResult {
    headers: Record<string, string>;
}

/**
 * 设置 CORS 选项
 * 根据环境变量或请求头动态设置跨域配置
 * @param req - 请求对象
 * @returns CORS 配置对象
 */
export const setCorsOptions = (req: Request): CorsResult => {
    return {
        headers: {
            'Access-Control-Allow-Origin': Env.ALLOWED_ORIGIN || req.headers.get('origin') || '*',
            'Access-Control-Allow-Methods': Env.ALLOWED_METHODS || 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': Env.ALLOWED_HEADERS || 'Content-Type, Authorization, authorization, token',
            'Access-Control-Expose-Headers': Env.EXPOSE_HEADERS || 'Content-Range, X-Content-Range, Authorization, authorization, token',
            'Access-Control-Max-Age': Env.MAX_AGE || 86400,
            'Access-Control-Allow-Credentials': Env.ALLOW_CREDENTIALS || 'true'
        }
    };
};

/**
 * 处理OPTIONS预检请求
 * @param corsOptions - CORS 配置对象
 * @returns 204 响应
 */
export function handleOptionsRequest(corsOptions: CorsResult): Response {
    return new Response(null, {
        status: 204,
        headers: corsOptions.headers
    });
}
