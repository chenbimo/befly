/**
 * 中间件集合
 * 整合所有请求处理中间件
 */

import { Env } from '../env.js';

// ========================================
// CORS 中间件
// ========================================

export interface CorsResult {
    headers: Record<string, string>;
}

/**
 * 设置 CORS 选项
 * 根据环境变量或请求头动态设置跨域配置
 *
 * 注意：Access-Control-Allow-Origin 只能返回单个源，不能用逗号分隔多个源
 * 如果配置了多个允许的源，需要根据请求的 Origin 动态返回匹配的源
 *
 * @param req - 请求对象
 * @returns CORS 配置对象
 */
export const setCorsOptions = (req: Request): CorsResult => {
    return {
        headers: {
            'Access-Control-Allow-Origin': Env.CORS_ALLOWED_ORIGIN === '*' ? req.headers.get('origin') : Env.CORS_ALLOWED_ORIGIN,
            'Access-Control-Allow-Methods': Env.CORS_ALLOWED_METHODS,
            'Access-Control-Allow-Headers': Env.CORS_ALLOWED_HEADERS,
            'Access-Control-Expose-Headers': Env.CORS_EXPOSE_HEADERS,
            'Access-Control-Max-Age': Env.CORS_MAX_AGE || 86400,
            'Access-Control-Allow-Credentials': Env.CORS_ALLOW_CREDENTIALS || 'true'
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
