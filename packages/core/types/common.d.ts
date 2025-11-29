/**
 * Befly 框架通用类型定义
 * 从 befly-shared 重新导出共享类型，并添加 core 专用类型
 */

// ============================================
// 从 befly-shared 重新导出共享类型
// ============================================
export type { ApiCodeType, DatabaseConfig, DatabaseType, ErrorMessageType, FieldDefinition, FieldType, HttpMethod, KeyValue, MenuItem, OrderDirection, PaginatedResult, PermissionItem, RedisConfig, ResponseResult, RoleInfo, SqlParams, SqlValue, TableDefinition, UserInfo, ValidationResult } from 'befly-shared';

export { ApiCode, ErrorMessages } from 'befly-shared';

// ============================================
// Core 专用类型（不适合放在 shared 中的类型）
// ============================================

/**
 * 字段规则字符串（已废弃，保留用于兼容）
 * 格式: "字段名|类型|最小值|最大值|默认值|是否索引|正则约束"
 *
 * @deprecated 请使用 FieldDefinition 对象格式
 * @example
 * "用户名|string|2|50|null|1|^[a-zA-Z0-9_]+$"
 * "年龄|number|0|150|18|0|null"
 */
export type FieldRule = string;

/**
 * 解析后的字段规则（已废弃，保留用于兼容）
 *
 * @deprecated 请使用 FieldDefinition 对象格式
 */
export interface ParsedFieldRule {
    name: string;
    type: 'string' | 'number' | 'text' | 'array_string' | 'array_text';
    min: number | null;
    max: number | null;
    default: any;
    index: 0 | 1;
    regex: string | null;
}

/**
 * 比较运算符
 */
export type ComparisonOperator = '=' | '>' | '<' | '>=' | '<=' | '!=' | '<>' | 'LIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL';

/**
 * JOIN 类型
 */
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

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
