/**
 * 请求上下文类型定义
 */

/**
 * 请求上下文接口
 */
export interface RequestContext {
    /** 请求体参数 */
    body: Record<string, any>;
    /** 用户信息 */
    user: Record<string, any>;
    /** 原始请求对象 */
    request: Request;
    /** 请求开始时间（毫秒） */
    startTime: number;
}
