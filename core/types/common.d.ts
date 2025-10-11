/**
 * Befly 框架通用类型定义
 */

/**
 * 响应结果类型
 */
export interface ResponseResult<T = any> {
    code: number;
    msg: string;
    data?: T;
    error?: any;
}

/**
 * 验证结果类型
 */
export interface ValidationResult {
    code: 0 | 1;
    fields: Record<string, any>;
}

/**
 * 字段规则类型 - 7段式定义
 * 格式: "显示名|类型|最小值|最大值|默认值|是否索引|正则约束"
 */
export type FieldRule = string;

/**
 * 表定义类型
 */
export type TableDefinition = Record<string, FieldRule>;

/**
 * 解析后的字段规则
 */
export interface ParsedFieldRule {
    label: string; // 显示名
    type: 'string' | 'number' | 'text' | 'array';
    min: number | null; // 最小值
    max: number | null; // 最大值
    default: any; // 默认值
    index: 0 | 1; // 是否索引
    regex: string | null; // 正则约束
}

/**
 * SQL 查询参数类型
 */
export type SqlValue = string | number | boolean | null | Date;
export type SqlParams = SqlValue[];

/**
 * 排序方向
 */
export type OrderDirection = 'ASC' | 'DESC' | 'asc' | 'desc';

/**
 * 比较运算符
 */
export type ComparisonOperator = '=' | '>' | '<' | '>=' | '<=' | '!=' | '<>' | 'LIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL';

/**
 * JOIN 类型
 */
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

/**
 * 数据库配置类型
 */
export interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    connectionLimit?: number;
}

/**
 * Redis 配置类型
 */
export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
}

/**
 * 日志级别
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * 日志配置
 */
export interface LoggerConfig {
    level?: LogLevel;
    transport?: {
        target: string;
        options?: Record<string, any>;
    };
}

/**
 * 环境变量类型
 */
export interface EnvConfig {
    // 服务配置
    appName: string;
    appHost: string;
    appPort: number;

    // 数据库配置
    mysqlHost: string;
    mysqlPort: number;
    mysqlUsername: string;
    mysqlPassword: string;
    mysqlDatabase: string;

    // Redis 配置
    redisHost?: string;
    redisPort?: number;
    redisPassword?: string;

    // JWT 配置
    jwtSecret: string;
    jwtExpires?: string;

    // 其他配置
    [key: string]: any;
}

/**
 * 工具函数返回类型
 */
export interface ToolResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * 分页参数
 */
export interface PaginationParams {
    page: number;
    limit: number;
}

/**
 * 分页结果
 */
export interface PaginatedResult<T = any> {
    total: number;
    page: number;
    limit: number;
    data: T[];
}

/**
 * 通用键值对
 */
export type KeyValue<T = any> = Record<string, T>;

/**
 * 可选字段
 */
export type Optional<T> = T | null | undefined;

/**
 * 深度可选
 */
export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

/**
 * 保留字段（系统自动管理）
 */
export type ReservedFields = 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'state';

/**
 * 排除保留字段
 */
export type ExcludeReserved<T> = Omit<T, ReservedFields>;

/**
 * 数据库记录基础类型
 */
export interface BaseRecord {
    id: number;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
    state: number;
}

/**
 * 异步函数类型
 */
export type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;

/**
 * 同步函数类型
 */
export type SyncFunction<T = any> = (...args: any[]) => T;

/**
 * 通用回调函数
 */
export type Callback<T = any> = (error: Error | null, result?: T) => void;
