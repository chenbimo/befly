/**
 * 数据库相关类型定义
 */

import type { SqlValue, WhereConditions } from './common';

/**
 * 查询选项
 */
export interface QueryOptions {
    /** 表名 */
    table: string;
    /** 查询字段 */
    fields?: string[];
    /** WHERE 条件 */
    where?: WhereConditions;
    /** 排序 */
    orderBy?: string;
    /** 页码（从 1 开始） */
    page?: number;
    /** 每页数量 */
    limit?: number;
    /** 是否包含已删除数据 */
    includeDeleted?: boolean;
    /** 自定义 state 条件 */
    customState?: WhereConditions;
}

/**
 * 插入选项
 */
export interface InsertOptions {
    /** 表名 */
    table: string;
    /** 插入数据 */
    data: Record<string, any>;
    /** 是否自动生成 ID */
    autoId?: boolean;
    /** 是否添加时间戳 */
    autoTimestamp?: boolean;
    /** 是否添加 state 字段 */
    autoState?: boolean;
}

/**
 * 更新选项
 */
export interface UpdateOptions {
    /** 表名 */
    table: string;
    /** 更新数据 */
    data: Record<string, any>;
    /** WHERE 条件 */
    where: WhereConditions;
    /** 是否自动更新时间戳 */
    autoTimestamp?: boolean;
    /** 是否包含已删除数据 */
    includeDeleted?: boolean;
}

/**
 * 删除选项
 */
export interface DeleteOptions {
    /** 表名 */
    table: string;
    /** WHERE 条件 */
    where: WhereConditions;
    /** 是否物理删除 */
    hard?: boolean;
    /** 是否自动更新时间戳（软删除时） */
    autoTimestamp?: boolean;
}

/**
 * 列表查询结果
 */
export interface ListResult<T = any> {
    /** 数据列表 */
    list: T[];
    /** 总条数 */
    total: number;
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    limit: number;
    /** 总页数 */
    pages: number;
}

/**
 * 事务回调函数
 */
export type TransactionCallback<T = any> = (trans: SqlManager) => Promise<T>;

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
 * 数据库类型
 */
export type DbType = 'mysql' | 'postgresql' | 'sqlite';

/**
 * 列信息
 */
export interface ColumnInfo {
    /** 列名 */
    name: string;
    /** 数据类型 */
    type: string;
    /** 是否可空 */
    nullable: boolean;
    /** 默认值 */
    default: any;
    /** 注释 */
    comment: string;
    /** 长度 */
    length?: number;
}

/**
 * 索引信息
 */
export interface IndexInfo {
    /** 索引名 */
    name: string;
    /** 列名 */
    column: string;
    /** 是否唯一 */
    unique: boolean;
}

/**
 * 同步统计
 */
export interface SyncStats {
    /** 创建的表数 */
    created: number;
    /** 修改的表数 */
    modified: number;
    /** 创建的索引数 */
    indexesCreated: number;
    /** 删除的索引数 */
    indexesDropped: number;
}

/**
 * 数据库连接接口（占位符，实际类型由 SqlManager 定义）
 */
export interface DatabaseConnection {
    query(sql: string, params?: any[]): Promise<any>;
    close(): Promise<void>;
}

/**
 * SqlManager 接口（前向声明）
 */
export interface SqlManager {
    getDetail<T = any>(options: QueryOptions): Promise<T | null>;
    getList<T = any>(options: QueryOptions): Promise<ListResult<T>>;
    getAll<T = any>(options: Omit<QueryOptions, 'page' | 'limit'>): Promise<T[]>;
    insData(options: InsertOptions): Promise<number>;
    updData(options: UpdateOptions): Promise<number>;
    delData(options: DeleteOptions): Promise<number>;
    trans<T = any>(callback: TransactionCallback<T>): Promise<T>;
    query(sql: string, params?: any[]): Promise<any>;
}

/**
 * SQL 客户端选项
 */
export interface SqlClientOptions {
    /** 最大连接数 */
    max?: number;
    /** 是否使用 BigInt */
    bigint?: boolean;
    /** 其他自定义选项 */
    [key: string]: any;
}
