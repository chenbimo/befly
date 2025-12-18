/**
 * Befly API 类型定义
 */

import type { BeflyContext } from "./befly.js";
import type { KeyValue } from "./common.js";
import type { RequestContext } from "./context.js";
import type { TableDefinition } from "./validate.js";

/**
 * HTTP 方法类型
 * 支持 GET、POST 或逗号分隔的组合
 */
export type HttpMethod = "GET" | "POST" | "GET,POST" | "POST,GET";

/**
 * 用户信息类型
 */
export interface UserInfo {
    id: number;
    username?: string;
    email?: string;
    role?: string;
    [key: string]: any;
}

/**
 * 认证类型
 * - false: 不需要认证
 * - true: 需要认证（验证 token）
 * - 'admin': 需要管理员权限
 * - 'user': 需要普通用户权限
 * - string[]: 需要特定角色
 */
export type AuthType = boolean | "admin" | "user" | string[];

/**
 * API 处理器函数类型
 */
export type ApiHandler<T = any, R = any> = (befly: BeflyContext, ctx: RequestContext) => Promise<Response | R> | Response | R;

/**
 * 字段规则定义
 * 键为字段名，值为字段规则字符串
 */
export type FieldRules = Record<string, string>;

/**
 * API 配置选项
 */
export interface ApiOptions {
    /** HTTP 方法 */
    method: HttpMethod;
    /** 是否需要认证（true/false/角色数组） */
    auth?: boolean | string[];
    /** 字段规则 */
    fields?: FieldRules;
    /** 必填字段 */
    required?: string[];
    /** 处理函数 */
    handler: ApiHandler;
}

/**
 * API 路由配置
 */
export interface ApiRoute<T = any, R = any> {
    /** 接口名称（必填） */
    name: string;

    /** 处理器函数（必填） */
    handler: ApiHandler<T, R>;

    /** HTTP 方法（可选，默认 POST，支持逗号分隔多个方法） */
    method?: HttpMethod;

    /** 认证类型（可选，默认 true）
     * - true: 需要登录
     * - false: 公开访问（无需登录）
     */
    auth?: boolean;

    /** 字段定义（验证规则）（可选，默认 {}） */
    fields?: TableDefinition;

    /** 必填字段（可选，默认 []） */
    required?: string[];

    /** 是否保留原始请求体（可选，默认 false）
     * - true: 不过滤字段，保留完整请求体（适用于微信回调、webhook 等场景）
     * - false: 根据 fields 定义过滤字段
     */
    rawBody?: boolean;

    /** 路由路径（运行时生成） */
    route?: string;
}

/**
 * API 构建器接口
 */
export interface ApiBuilder {
    /** 设置 HTTP 方法 */
    method(method: HttpMethod): this;

    /** 设置路径 */
    path(path: string): this;

    /** 设置描述 */
    description(desc: string): this;

    /** 设置认证 */
    auth(auth: AuthType): this;

    /** 设置验证规则 */
    rules(rules: KeyValue<string>): this;

    /** 设置必填字段 */
    required(fields: string[]): this;

    /** 设置处理器 */
    handler(handler: ApiHandler): this;

    /** 构建路由 */
    build(): ApiRoute;
}

/**
 * API 响应辅助函数
 */
export interface ApiResponse {
    /** 成功响应 */
    success<T = any>(message: string, data?: T): Response;

    /** 失败响应 */
    error(message: string, error?: any): Response;

    /** JSON 响应 */
    json<T = any>(data: T, status?: number): Response;

    /** 文本响应 */
    text(text: string, status?: number): Response;

    /** HTML 响应 */
    html(html: string, status?: number): Response;

    /** 重定向 */
    redirect(url: string, status?: number): Response;
}

/**
 * 路由匹配结果
 */
export interface RouteMatch {
    /** 路由配置 */
    route: ApiRoute;

    /** 路径参数 */
    params: KeyValue<string>;
}

/**
 * 路由器接口
 */
export interface Router {
    /** 添加路由 */
    add(route: ApiRoute): void;

    /** 匹配路由 */
    match(method: HttpMethod, path: string): RouteMatch | null;

    /** 获取所有路由 */
    getRoutes(): ApiRoute[];

    /** 删除路由 */
    remove(method: HttpMethod, path: string): boolean;
}

// ========== API 响应数据类型 ==========

/**
 * 令牌检测响应数据
 */
export interface TokenCheckData {
    /** 令牌是否有效 */
    valid: boolean;
    /** JWT 载荷（有效时返回） */
    payload?: any;
    /** 过期时间（秒） */
    expiresIn?: number;
}

/**
 * 健康检查响应数据
 */
export interface HealthInfo {
    /** 服务状态 */
    status: string;
    /** 时间戳 */
    timestamp: string;
    /** 运行时长（秒） */
    uptime: number;
    /** 内存使用情况 */
    memory: NodeJS.MemoryUsage;
    /** 运行时名称 */
    runtime: string;
    /** 版本号 */
    version: string;
    /** 平台 */
    platform: string;
    /** 架构 */
    arch: string;
    /** Redis 状态 */
    redis?: string;
    /** Redis 错误信息 */
    redisError?: string;
    /** 数据库状态 */
    database?: string;
    /** 数据库错误信息 */
    databaseError?: string;
}
