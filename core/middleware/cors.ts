/**
 * CORS 中间件
 * 处理跨域请求
 */

import { setCorsOptions } from '../utils/index.js';

export interface CorsResult {
    headers: Record<string, string>;
}

/**
 * 处理CORS
 */
export function handleCors(req: Request): CorsResult {
    return setCorsOptions(req);
}

/**
 * 处理OPTIONS预检请求
 */
export function handleOptionsRequest(corsOptions: CorsResult): Response {
    return new Response(null, {
        status: 204,
        headers: corsOptions.headers
    });
}
