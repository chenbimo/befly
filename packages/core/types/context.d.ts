/**
 * 请求上下文类型定义
 */

import type { ApiRoute } from "./api.ts";

/**
 * 请求上下文接口
 */
export interface RequestContext {
    /** 请求方法 (GET/POST) */
    method: string;
    /** 请求体参数 */
    body: Record<string, any>;
    /** 用户信息 */
    user: Record<string, any>;
    /** 原始请求对象 */
    req: Request;
    /** 请求开始时间（毫秒） */
    now: number;
    /** 客户端 IP 地址 */
    ip: string;
    /** 请求头 */
    headers: Headers;
    /** API 路由路径（url.pathname，例如 /api/user/login；与 method 无关） */
    route: string;
    /** 请求唯一 ID */
    requestId: string;
    /** CORS 响应头 */
    corsHeaders: Record<string, string>;
    /** 当前请求的 API 路由对象 */
    api?: ApiRoute;
    /** 响应对象（如果设置了此属性，将直接返回该响应） */
    response?: Response;
    /** 原始处理结果（未转换为 Response 对象前） */
    result?: any;
}
