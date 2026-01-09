/**
 * 数据库操作相关类型定义
 */

import type { JoinOption, SqlValue, WhereConditions } from "./common";

/**
 * 表名到行类型的映射（项目侧可通过 declaration merging 扩展）。
 *
 * 用法（项目侧）：
 * declare module "befly/types/database" {
 *   interface DbRowMap {
 *     user: { id: number; nickname?: string };
 *   }
 * }
 */
export interface DbRowMap {}

export type DbTableName = keyof DbRowMap & string;

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
    params: SqlValue[];
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
export type DbUnknownRow = Record<string, SqlValue>;

export type DbResult<TData = DbUnknownRow, TSql = SqlInfo> = {
    data: TData;
    sql: TSql;
};

/**
 * 分页结果
 */
export interface DbPageResult<TItem = DbUnknownRow> {
    lists: TItem[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

/**
 * 不分页结果（带 total）
 */
export interface DbListResult<TItem = DbUnknownRow> {
    lists: TItem[];
    total: number;
}

/**
 * 事务回调
 */
export type TransactionCallback<TResult = void, TDb = DbHelper> = (db: TDb) => Promise<TResult>;

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
    getCount<TTable extends DbTableName>(options: Omit<QueryOptions, "fields" | "page" | "limit" | "orderBy" | "table"> & { table: TTable }): Promise<DbResult<number>>;
    getCount(options: Omit<QueryOptions, "fields" | "page" | "limit" | "orderBy">): Promise<DbResult<number>>;

    getOne<TTable extends DbTableName>(options: Omit<QueryOptions, "table"> & { table: TTable }): Promise<DbResult<DbRowMap[TTable]>>;
    getOne<TItem = DbUnknownRow>(options: QueryOptions): Promise<DbResult<TItem>>;

    getDetail<TTable extends DbTableName>(options: Omit<QueryOptions, "table"> & { table: TTable }): Promise<DbResult<DbRowMap[TTable]>>;
    getDetail<TItem = DbUnknownRow>(options: QueryOptions): Promise<DbResult<TItem>>;

    getList<TTable extends DbTableName>(options: Omit<QueryOptions, "table"> & { table: TTable }): Promise<DbResult<DbPageResult<DbRowMap[TTable]>, ListSql>>;
    getList<TItem = DbUnknownRow>(options: QueryOptions): Promise<DbResult<DbPageResult<TItem>, ListSql>>;

    getAll<TTable extends DbTableName>(options: Omit<QueryOptions, "table" | "page" | "limit"> & { table: TTable }): Promise<DbResult<DbListResult<DbRowMap[TTable]>, ListSql>>;
    getAll<TItem = DbUnknownRow>(options: Omit<QueryOptions, "page" | "limit">): Promise<DbResult<DbListResult<TItem>, ListSql>>;

    exists<TTable extends DbTableName>(options: Omit<QueryOptions, "fields" | "orderBy" | "page" | "limit" | "table"> & { table: TTable }): Promise<DbResult<boolean>>;
    exists(options: Omit<QueryOptions, "fields" | "orderBy" | "page" | "limit">): Promise<DbResult<boolean>>;

    getFieldValue<TTable extends DbTableName, TField extends keyof DbRowMap[TTable] & string>(options: Omit<QueryOptions, "fields" | "table"> & { table: TTable; field: TField }): Promise<DbResult<DbRowMap[TTable][TField] | null>>;
    getFieldValue<TValue = SqlValue>(options: Omit<QueryOptions, "fields"> & { field: string }): Promise<DbResult<TValue | null>>;

    // ========== write ==========
    insData<TInsert extends Record<string, SqlValue> = Record<string, SqlValue>>(options: Omit<InsertOptions, "data"> & { data: TInsert | TInsert[] }): Promise<DbResult<number>>;
    insBatch<TInsert extends Record<string, SqlValue> = Record<string, SqlValue>>(table: string, dataList: TInsert[]): Promise<DbResult<number[]>>;

    updData(options: UpdateOptions): Promise<DbResult<number>>;
    updBatch(table: string, dataList: Array<{ id: number; data: Record<string, SqlValue> }>): Promise<DbResult<number>>;

    delData(options: DeleteOptions): Promise<DbResult<number>>;
    delForce(options: Omit<DeleteOptions, "hard">): Promise<DbResult<number>>;
    delForceBatch(table: string, ids: number[]): Promise<DbResult<number>>;

    enableData(options: Omit<DeleteOptions, "hard">): Promise<DbResult<number>>;
    disableData(options: Omit<DeleteOptions, "hard">): Promise<DbResult<number>>;

    // ========== raw / transaction ==========
    query<TResult = DbUnknownRow[]>(sql: string, params?: SqlValue[]): Promise<DbResult<TResult>>;
    unsafe<TResult = DbUnknownRow[]>(sqlStr: string, params?: SqlValue[]): Promise<DbResult<TResult>>;
    trans<TResult = void>(callback: TransactionCallback<TResult, DbHelper>): Promise<TResult>;

    // ========== numeric helpers ==========
    increment(table: string, field: string, where: WhereConditions, value?: number): Promise<DbResult<number>>;
    decrement(table: string, field: string, where: WhereConditions, value?: number): Promise<DbResult<number>>;
}
