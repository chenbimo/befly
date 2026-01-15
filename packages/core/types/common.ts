/**
 * Befly 框架通用类型定义
 * 框架核心通用类型定义
 */

/**
 * JSON 可序列化值（用于对外类型的兜底数据类型）
 */
export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
    [key: string]: JsonValue | undefined;
}

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

/**
 * SQL 值类型
 */
export type SqlValue = string | number | boolean | null | Date | JsonObject | JsonValue[];

/**
 * 通用键值对类型
 */
export type KeyValue<T = JsonValue> = Record<string, T>;

// ============================================
// SQL 查询相关类型
// ============================================

/**
 * WHERE 条件操作符
 */
export type WhereOperator = "$eq" | "$ne" | "$not" | "$gt" | "$gte" | "$lt" | "$lte" | "$like" | "$notLike" | "$in" | "$notIn" | "$nin" | "$isNull" | "$isNotNull" | "$null" | "$notNull" | "$between" | "$notBetween";

/**
 * WHERE 条件类型
 */
export interface WhereOperatorObject {
    [op: string]: SqlValue | SqlValue[] | undefined;
}

export type WhereFieldValue = SqlValue | SqlValue[] | WhereOperatorObject | WhereConditions;

export type WhereEntryValue = WhereFieldValue | WhereConditions[];

export interface WhereConditions {
    $and?: WhereConditions[];
    $or?: WhereConditions[];
    [key: string]: WhereEntryValue | undefined;
}

/**
 * 排序方向
 */
export type OrderDirection = "ASC" | "DESC";

/**
 * 排序字段
 */
export type OrderByField = string | { field: string; direction: OrderDirection };

/**
 * SQL 查询结果
 */
export interface SqlQuery {
    sql: string;
    params: SqlValue[];
}

/**
 * 插入数据类型
 */
export type InsertData = Record<string, SqlValue> | Record<string, SqlValue>[];

/**
 * 更新数据类型
 */
export type UpdateData = Record<string, SqlValue>;

/**
 * 任意对象类型
 */
export type AnyObject = JsonObject;

// ============================================
// Core 专用类型（不适合放在 shared 中的类型）
// ============================================

/**
 * 比较运算符
 */
export type ComparisonOperator = "=" | ">" | "<" | ">=" | "<=" | "!=" | "<>" | "LIKE" | "IN" | "NOT IN" | "IS NULL" | "IS NOT NULL";

/**
 * JOIN 类型
 */
export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL";

/**
 * JOIN 选项
 * 用于简化多表联查的写法
 */
export interface JoinOption {
    /** JOIN 类型，默认 'left' */
    type?: "left" | "right" | "inner";
    /** 要联接的表名（不支持别名） */
    table: string;
    /** JOIN 条件（如 'order.user_id = user.id'） */
    on: string;
}

/**
 * 工具函数返回类型
 */
export interface ToolResponse<T = JsonValue> {
    success: boolean;
    data?: T;
    error?: string;
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
export type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>;

/**
 * 同步函数类型
 */
export type SyncFunction<T = unknown> = (...args: unknown[]) => T;

/**
 * 通用回调函数
 */
export type Callback<T = unknown> = (error: Error | null, result?: T) => void;
