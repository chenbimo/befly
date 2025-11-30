/**
 * API 相关类型定义
 */

import type { TableDefinition } from './validate';

/**
 * HTTP 方法类型
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * API 响应结果类型
 */
export interface ResponseResult<T = any> {
    /** 状态码：0 表示成功，非 0 表示失败 */
    code: number;
    /** 响应消息 */
    msg: string;
    /** 响应数据 */
    data?: T;
    /** 错误信息（仅在失败时） */
    error?: any;
}

/**
 * 分页响应结果类型
 */
export interface PaginatedResult<T = any> {
    /** 状态码 */
    code: number;
    /** 响应消息 */
    msg: string;
    /** 数据列表 */
    data: T[];
    /** 总记录数 */
    total: number;
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    limit: number;
    /** 总页数 */
    pages: number;
}

/**
 * API 路由基础配置
 * 用于跨包共享的最小路由定义
 */
export interface BaseApiRoute {
    /** 接口名称（必填） */
    name: string;
    /** HTTP 方法（可选，默认 POST） */
    method?: HttpMethod;
    /** 认证类型（可选，默认 true） */
    auth?: boolean;
    /** 字段定义（验证规则） */
    fields?: TableDefinition;
    /** 必填字段 */
    required?: string[];
    /** 路由路径（运行时生成） */
    route?: string;
}
