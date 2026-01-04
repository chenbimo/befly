/**
 * 数据库操作相关类型定义
 */

import type { JoinOption, SqlValue, WhereConditions } from "./common.ts";

/**
 * 数据库类型
 */
export type DatabaseType = "mysql" | "postgres" | "sqlite";

/**
 * 查询选项
 */
export interface QueryOptions {
    /** 表名 */
    table: string;
    /** 查询字段 */
    fields?: string[];
    /** 查询条件 */
    where?: WhereConditions;
    /** 多表联查选项 */
    joins?: JoinOption[];
    /** 排序 */
    orderBy?: string[];
    /** 页码（从 1 开始） */
    page?: number;
    /** 每页数量 */
    limit?: number;
}

/**
 * 插入选项
 */
export interface InsertOptions {
    /** 表名 */
    table: string;
    /** 插入数据 */
    data: Record<string, SqlValue> | Record<string, SqlValue>[];
    /** 是否返回插入 ID */
    returnId?: boolean;
}

/**
 * 更新选项
 */
export interface UpdateOptions {
    /** 表名 */
    table: string;
    /** 更新数据 */
    data: Record<string, SqlValue>;
    /** 更新条件 */
    where: WhereConditions;
}

/**
 * 删除选项
 */
export interface DeleteOptions {
    /** 表名 */
    table: string;
    /** 删除条件 */
    where: WhereConditions;
    /** 是否物理删除（默认逻辑删除） */
    hard?: boolean;
}

/**
 * SQL 执行信息
 */
export interface SqlInfo {
    sql: string;
    params: any[];
    duration: number;
}

/**
 * getList/getAll 的 SQL 信息（count/data 两段）
 */
export interface ListSql {
    count: SqlInfo;
    data?: SqlInfo;
}

/**
 * 统一返回结构
 */
export interface DbResult<T = any, SqlT = SqlInfo> {
    data: T;
    sql: SqlT;
}

/**
 * 分页结果
 */
export interface ListResult<T = any> {
    lists: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

/**
 * 不分页结果（带 total）
 */
export interface AllResult<T = any> {
    lists: T[];
    total: number;
}

/**
 * 事务回调
 */
export type TransactionCallback<T = any> = (db: any) => Promise<T>;
