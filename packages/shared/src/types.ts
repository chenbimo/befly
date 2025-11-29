/**
 * Befly 共享类型定义
 * 这些类型可以在 core、tpl、admin 等多个包中复用
 */

// ============================================
// 通用响应类型
// ============================================

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
 * 验证结果类型
 */
export interface ValidationResult {
    /** 验证状态：0 成功，1 失败 */
    code: 0 | 1;
    /** 字段错误信息 */
    fields: Record<string, string>;
}

// ============================================
// HTTP 相关类型
// ============================================

/**
 * HTTP 方法类型
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * 通用键值对类型
 */
export type KeyValue<T = any> = Record<string, T>;

// ============================================
// 字段定义类型
// ============================================

/**
 * 字段类型
 */
export type FieldType = 'string' | 'number' | 'text' | 'array_string' | 'array_text';

/**
 * 字段定义类型（对象格式）
 */
export interface FieldDefinition {
    /** 字段标签/描述 */
    name: string;
    /** 字段详细说明 */
    detail: string;
    /** 字段类型 */
    type: FieldType;
    /** 最小值/最小长度 */
    min: number | null;
    /** 最大值/最大长度 */
    max: number | null;
    /** 默认值 */
    default: any;
    /** 是否创建索引 */
    index: boolean;
    /** 是否唯一 */
    unique: boolean;
    /** 字段注释 */
    comment: string;
    /** 是否允许为空 */
    nullable: boolean;
    /** 是否无符号（仅 number 类型） */
    unsigned: boolean;
    /** 正则验证 */
    regexp: string | null;
}

/**
 * 表定义类型（对象格式）
 */
export type TableDefinition = Record<string, FieldDefinition>;

// ============================================
// 用户相关类型
// ============================================

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

// ============================================
// 请求上下文类型（基础版）
// ============================================

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

// ============================================
// API 路由类型（基础版）
// ============================================

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

// ============================================
// 数据库相关类型
// ============================================

/**
 * SQL 值类型
 */
export type SqlValue = string | number | boolean | null | Date;

/**
 * SQL 参数数组类型
 */
export type SqlParams = SqlValue[];

/**
 * 排序方向
 */
export type OrderDirection = 'ASC' | 'DESC' | 'asc' | 'desc';

/**
 * 数据库类型
 */
export type DatabaseType = 'mysql' | 'postgresql' | 'sqlite';

/**
 * 数据库配置类型
 */
export interface DatabaseConfig {
    /** 数据库类型 */
    type: DatabaseType;
    /** 主机地址 */
    host: string;
    /** 端口号 */
    port: number;
    /** 用户名 */
    user: string;
    /** 密码 */
    password: string;
    /** 数据库名 */
    database: string;
}

/**
 * Redis 配置类型
 */
export interface RedisConfig {
    /** 主机地址 */
    host: string;
    /** 端口号 */
    port: number;
    /** 密码 */
    password?: string;
    /** 数据库索引 */
    db?: number;
}

// ============================================
// 菜单和权限类型
// ============================================

/**
 * 菜单项类型
 */
export interface MenuItem {
    /** 菜单 ID */
    id: number;
    /** 父级 ID */
    pid: number;
    /** 菜单名称 */
    name: string;
    /** 菜单路径 */
    path: string;
    /** 菜单图标 */
    icon?: string;
    /** 排序 */
    sort: number;
    /** 是否隐藏 */
    hidden?: boolean;
    /** 子菜单 */
    children?: MenuItem[];
}

/**
 * 权限项类型
 */
export interface PermissionItem {
    /** API 路由（如 POST/api/user/list） */
    route: string;
    /** 权限名称 */
    name: string;
}

/**
 * 角色信息类型
 */
export interface RoleInfo {
    /** 角色 ID */
    id: number;
    /** 角色代码 */
    code: string;
    /** 角色名称 */
    name: string;
    /** 角色描述 */
    desc?: string;
}

// ============================================
// API 响应码常量
// ============================================

/**
 * API 响应码
 */
export const ApiCode = {
    /** 成功 */
    SUCCESS: 0,
    /** 通用失败 */
    FAIL: 1,
    /** 未授权 */
    UNAUTHORIZED: 401,
    /** 禁止访问 */
    FORBIDDEN: 403,
    /** 未找到 */
    NOT_FOUND: 404,
    /** 服务器错误 */
    SERVER_ERROR: 500
} as const;

/**
 * API 响应码类型
 */
export type ApiCodeType = (typeof ApiCode)[keyof typeof ApiCode];

// ============================================
// 错误消息常量
// ============================================

/**
 * 通用错误消息
 */
export const ErrorMessages = {
    /** 未授权 */
    UNAUTHORIZED: '请先登录',
    /** 禁止访问 */
    FORBIDDEN: '无访问权限',
    /** 未找到 */
    NOT_FOUND: '资源不存在',
    /** 服务器错误 */
    SERVER_ERROR: '服务器错误',
    /** 参数错误 */
    INVALID_PARAMS: '参数错误',
    /** Token 过期 */
    TOKEN_EXPIRED: 'Token 已过期',
    /** Token 无效 */
    TOKEN_INVALID: 'Token 无效'
} as const;

/**
 * 错误消息类型
 */
export type ErrorMessageType = (typeof ErrorMessages)[keyof typeof ErrorMessages];
