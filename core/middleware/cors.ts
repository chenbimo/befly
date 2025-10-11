/**
 * CORS 中间件
 * 处理跨域请求
 */

export interface CorsResult {
    headers: Record<string, string>;
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
