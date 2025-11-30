/**
 * 请求上下文相关类型定义
 */

/**
 * 用户信息类型
 */
export interface UserInfo {
    /** 用户 ID */
    id: number;
    /** 用户名 */
    username?: string;
    /** 邮箱 */
    email?: string;
    /** 角色代码 */
    roleCode?: string;
    /** 其他自定义字段 */
    [key: string]: any;
}

/**
 * 请求上下文基础接口
 * 用于跨包共享的最小上下文定义
 */
export interface BaseRequestContext {
    /** 请求体参数 */
    body: Record<string, any>;
    /** 用户信息 */
    user: Record<string, any>;
    /** 请求开始时间（毫秒） */
    now: number;
    /** 客户端 IP 地址 */
    ip: string;
    /** API 路由路径（如 POST/api/user/login） */
    route: string;
    /** 请求唯一 ID */
    requestId: string;
}
