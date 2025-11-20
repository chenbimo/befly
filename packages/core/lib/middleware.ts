/**
 * 中间件集合
 * 整合所有请求处理中间件
 */

import type { CorsConfig } from '../types/befly.js';

// ========================================
// CORS 中间件
// ========================================

export interface CorsResult {
    headers: Record<string, string>;
}

/**
 * 设置 CORS 选项
 * 根据配置或请求头动态设置跨域配置
 *
 * @param req - 请求对象
 * @param config - CORS 配置
 * @returns CORS 配置对象
 */
export const setCorsOptions = (req: Request, config: CorsConfig = {}): CorsResult => {
    const origin = config.origin || '*';
    const methods = config.methods || 'GET, POST, PUT, DELETE, OPTIONS';
    const allowedHeaders = config.allowedHeaders || 'Content-Type, Authorization, authorization, token';
    const exposedHeaders = config.exposedHeaders || 'Content-Range, X-Content-Range, Authorization, authorization, token';
    const maxAge = config.maxAge || 86400;
    const credentials = config.credentials || 'true';

    return {
        headers: {
            'Access-Control-Allow-Origin': origin === '*' ? req.headers.get('origin') || '*' : origin,
            'Access-Control-Allow-Methods': methods,
            'Access-Control-Allow-Headers': allowedHeaders,
            'Access-Control-Expose-Headers': exposedHeaders,
            'Access-Control-Max-Age': String(maxAge),
            'Access-Control-Allow-Credentials': credentials
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
