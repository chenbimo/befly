/**
 * 数据库相关类型定义
 */

import type { SqlValue, WhereConditions } from './common';

// 重新导出 WhereOperator 和 WhereConditions，供其他模块使用
export type { WhereOperator, WhereConditions } from './index';

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
    /** 排序（格式：["字段#ASC", "字段#DESC"]） */
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
    /** 插入数据（ID、时间戳、state 会自动生成） */
    data: Record<string, any>;
}

/**
 * 更新选项
 */
export interface UpdateOptions {
    /** 表名 */
    table: string;
    /** 更新数据（updated_at 会自动更新） */
    data: Record<string, any>;
    /** WHERE 条件 */
    where: WhereConditions;
}

/**
 * 删除选项
 */
export interface DeleteOptions {
    /** 表名 */
    table: string;
    /** WHERE 条件 */
    where: WhereConditions;
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
export type TransactionCallback<T = any> = (trans: DbHelper) => Promise<T>;

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
 * DbHelper 接口（前向声明）
 */
export interface DbHelper {
    getCount(options: Omit<QueryOptions, 'fields' | 'page' | 'limit' | 'orderBy'>): Promise<number>;
    getOne<T = any>(options: QueryOptions): Promise<T | null>;
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
    /** 连接超时时间（毫秒），默认 5000ms */
    connectionTimeout?: number;
    /** 其他自定义选项 */
    [key: string]: any;
}

// ========== 数据库同步相关类型 ==========

/**
 * 列信息接口（用于数据库同步）
 */
export interface ColumnInfo {
    /** 字段类型（如 string, number 等） */
    type: string;
    /** 数据库列类型（如 VARCHAR, INT 等） */
    columnType: string;
    /** 字段长度 */
    length: number | null;
    /** 是否可空 */
    nullable: boolean;
    /** 默认值 */
    defaultValue: any;
    /** 字段注释 */
    comment: string | null;
}

/**
 * 索引信息接口
 */
export interface IndexInfo {
    /** 索引名称到字段数组的映射 */
    [indexName: string]: string[];
}

/**
 * 字段变更类型
 */
export interface FieldChange {
    /** 变更类型 */
    type: 'length' | 'comment' | 'datatype' | 'default';
    /** 当前值 */
    current: any;
    /** 新值 */
    new: any;
}

/**
 * 索引操作接口
 */
export interface IndexAction {
    /** 操作类型：create（创建）或 drop（删除） */
    action: 'create' | 'drop';
    /** 索引名称 */
    indexName: string;
    /** 字段名称 */
    fieldName: string;
}

/**
 * 表同步计划接口
 */
export interface TablePlan {
    /** 是否有变更 */
    changed: boolean;
    /** 添加字段的 SQL 子句 */
    addClauses: string[];
    /** 修改字段的 SQL 子句 */
    modifyClauses: string[];
    /** 默认值变更的 SQL 子句 */
    defaultClauses: string[];
    /** 索引操作列表 */
    indexActions: IndexAction[];
    /** 注释变更的 SQL 子句（可选） */
    commentActions?: string[];
}

/**
 * 全局统计计数接口
 */
export interface GlobalCount {
    /** 已处理表数量 */
    processedTables: number;
    /** 创建表数量 */
    createdTables: number;
    /** 修改表数量 */
    modifiedTables: number;
    /** 新增字段数量 */
    addFields: number;
    /** 类型变更数量 */
    typeChanges: number;
    /** 最大值变更数量 */
    maxChanges: number;
    /** 最小值变更数量 */
    minChanges: number;
    /** 默认值变更数量 */
    defaultChanges: number;
    /** 名称变更数量 */
    nameChanges: number;
    /** 索引创建数量 */
    indexCreate: number;
    /** 索引删除数量 */
    indexDrop: number;
}
