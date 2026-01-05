/**
 * 数据库操作相关类型定义
 */

import type { JoinOption, SqlValue, WhereConditions } from "./common";

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

/**
 * DbHelper 公开接口（类型层）。
 *
 * 说明：runtime 的实现位于 core 内部（dist/lib），但对外类型应只从 `befly/types/*` 获取。
 * 这里提供一个与实际实现对齐的接口，用于 BeflyContext.db 的类型标注。
 */
export interface DbHelper {
    // ========== schema / meta ==========
    tableExists(tableName: string): Promise<DbResult<boolean>>;

    // ========== query ==========
    getCount(options: Omit<QueryOptions, "fields" | "page" | "limit" | "orderBy">): Promise<DbResult<number>>;
    getOne<T extends Record<string, any> = Record<string, any>>(options: QueryOptions): Promise<DbResult<T | null>>;
    getList<T extends Record<string, any> = Record<string, any>>(options: QueryOptions): Promise<DbResult<ListResult<T>, ListSql>>;
    getAll<T extends Record<string, any> = Record<string, any>>(options: Omit<QueryOptions, "page" | "limit">): Promise<DbResult<AllResult<T>, ListSql>>;

    exists(options: Omit<QueryOptions, "fields" | "orderBy" | "page" | "limit">): Promise<DbResult<boolean>>;

    getFieldValue<T = any>(options: Omit<QueryOptions, "fields"> & { field: string }): Promise<DbResult<T | null>>;

    // ========== write ==========
    insData(options: InsertOptions): Promise<DbResult<number>>;
    insBatch(table: string, dataList: Record<string, any>[]): Promise<DbResult<number[]>>;

    updData(options: UpdateOptions): Promise<DbResult<number>>;
    updBatch(table: string, dataList: Array<{ id: number; data: Record<string, any> }>): Promise<DbResult<number>>;

    delData(options: DeleteOptions): Promise<DbResult<number>>;
    delForce(options: Omit<DeleteOptions, "hard">): Promise<DbResult<number>>;
    delForceBatch(table: string, ids: number[]): Promise<DbResult<number>>;

    enableData(options: Omit<DeleteOptions, "hard">): Promise<DbResult<number>>;
    disableData(options: Omit<DeleteOptions, "hard">): Promise<DbResult<number>>;

    // ========== raw / transaction ==========
    query(sql: string, params?: any[]): Promise<DbResult<any>>;
    unsafe(sqlStr: string, params?: any[]): Promise<DbResult<any>>;
    trans<T = any>(callback: TransactionCallback<T>): Promise<T>;

    // ========== numeric helpers ==========
    increment(table: string, field: string, where: WhereConditions, value?: number): Promise<DbResult<number>>;
    decrement(table: string, field: string, where: WhereConditions, value?: number): Promise<DbResult<number>>;

    // 兜底：允许实现层新增方法而不阻断使用方（保持兼容）
    [key: string]: any;
}
