/**
 * 数据库相关类型定义
 */

import type { SqlValue } from "./common";
import type { JoinOption } from "./common";
import type { DatabaseTables, TableName, TableType, TableInsertType, TableUpdateType, TypedWhereConditions } from "./table";

// 重新导出表类型工具
export type { DatabaseTables, TableName, TableType, TableInsertType, TableUpdateType, SystemFields, BaseTable, InsertType, UpdateType, SelectType, TypedWhereConditions } from "./table";

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
export type WhereConditions = Record<string, any>;

/**
 * 排序方向
 */
export type OrderDirection = "ASC" | "DESC";

/**
 * 排序字段
 */
export type OrderByField = string | { field: string; direction: OrderDirection };

// ============================================
// 泛型查询选项（类型安全版本）
// ============================================

/**
 * 泛型查询选项 - 支持类型推断
 * @template K - 表名类型
 */
export interface TypedQueryOptions<K extends TableName> {
    /** 表名 */
    table: K;
    /** 查询字段（表字段的子集） */
    fields?: (keyof TableType<K>)[] | string[];
    /** WHERE 条件（类型安全） */
    where?: TypedWhereConditions<TableType<K>> | WhereConditions;
    /** 排序（格式：["字段#ASC", "字段#DESC"]） */
    orderBy?: string[];
    /** 页码（从 1 开始） */
    page?: number;
    /** 每页数量 */
    limit?: number;
}

/**
 * 泛型插入选项 - 支持类型推断
 * @template K - 表名类型
 */
export interface TypedInsertOptions<K extends TableName> {
    /** 表名 */
    table: K;
    /** 插入数据（ID、时间戳、state 会自动生成） */
    data: TableInsertType<K> | Record<string, any>;
}

/**
 * 泛型更新选项 - 支持类型推断
 * @template K - 表名类型
 */
export interface TypedUpdateOptions<K extends TableName> {
    /** 表名 */
    table: K;
    /** 更新数据（updated_at 会自动更新） */
    data: TableUpdateType<K> | Record<string, any>;
    /** WHERE 条件 */
    where: TypedWhereConditions<TableType<K>> | WhereConditions;
}

/**
 * 泛型删除选项 - 支持类型推断
 * @template K - 表名类型
 */
export interface TypedDeleteOptions<K extends TableName> {
    /** 表名 */
    table: K;
    /** WHERE 条件 */
    where: TypedWhereConditions<TableType<K>> | WhereConditions;
}

// ============================================
// 兼容旧版查询选项（非类型安全版本）
// ============================================

/**
 * 查询选项（兼容旧版，不进行类型检查）
 */
export interface QueryOptions {
    /** 表名（可带别名，如 'order o'） */
    table: string;
    /** 查询字段（联查时需带表别名，如 'o.id', 'u.username'） */
    fields?: string[];
    /** WHERE 条件（联查时字段需带表别名，如 { 'o.state': 1 }） */
    where?: WhereConditions;
    /** 多表联查选项 */
    joins?: JoinOption[];
    /** 排序（格式：["字段#ASC", "字段#DESC"]） */
    orderBy?: string[];
    /** 页码（从 1 开始） */
    page?: number;
    /** 每页数量 */
    limit?: number;
}

/**
 * 插入选项（兼容旧版）
 */
export interface InsertOptions {
    /** 表名 */
    table: string;
    /** 插入数据（ID、时间戳、state 会自动生成） */
    data: Record<string, any>;
}

/**
 * 更新选项（兼容旧版）
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
 * 删除选项（兼容旧版）
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
    lists: T[];
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
 * 全部查询结果
 */
export interface AllResult<T = any> {
    /** 数据列表 */
    lists: T[];
    /** 总条数 */
    total: number;
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
export type DbType = "mysql" | "postgresql" | "sqlite";

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
 * 支持两种使用方式：
 * 1. 类型安全模式：使用 TypedQueryOptions 等泛型接口，获得完整类型推断
 * 2. 兼容模式：使用 QueryOptions 等非泛型接口，行为与之前一致
 */
export interface DbHelper {
    // ============================================
    // 类型安全方法（推荐）
    // ============================================

    /**
     * 查询记录数（类型安全版本）
     * @template K - 表名类型
     */
    getCount<K extends TableName>(options: Omit<TypedQueryOptions<K>, "fields" | "page" | "limit" | "orderBy">): Promise<number>;

    /**
     * 查询单条数据（类型安全版本）
     * @template K - 表名类型
     * @returns 返回类型自动推断为对应表的记录类型
     */
    getOne<K extends TableName>(options: TypedQueryOptions<K>): Promise<TableType<K> | null>;

    /**
     * 查询列表（类型安全版本）
     * @template K - 表名类型
     * @returns 返回类型自动推断为对应表的记录列表
     */
    getList<K extends TableName>(options: TypedQueryOptions<K>): Promise<ListResult<TableType<K>>>;

    /**
     * 查询所有数据（类型安全版本）
     * @template K - 表名类型
     * @returns 返回类型自动推断为对应表的记录数组
     */
    getAll<K extends TableName>(options: Omit<TypedQueryOptions<K>, "page" | "limit">): Promise<AllResult<TableType<K>>>;

    /**
     * 插入数据（类型安全版本）
     * @template K - 表名类型
     */
    insData<K extends TableName>(options: TypedInsertOptions<K>): Promise<number>;

    /**
     * 更新数据（类型安全版本）
     * @template K - 表名类型
     */
    updData<K extends TableName>(options: TypedUpdateOptions<K>): Promise<number>;

    /**
     * 删除数据（类型安全版本）
     * @template K - 表名类型
     */
    delData<K extends TableName>(options: TypedDeleteOptions<K>): Promise<number>;

    // ============================================
    // 兼容旧版方法（手动指定返回类型）
    // ============================================

    /**
     * 查询记录数（兼容版本）
     */
    getCount(options: Omit<QueryOptions, "fields" | "page" | "limit" | "orderBy">): Promise<number>;

    /**
     * 查询单条数据（兼容版本，需手动指定泛型）
     * @template T - 返回类型
     */
    getOne<T = any>(options: QueryOptions): Promise<T | null>;

    /**
     * 查询列表（兼容版本，需手动指定泛型）
     * @template T - 列表项类型
     */
    getList<T = any>(options: QueryOptions): Promise<ListResult<T>>;

    /**
     * 查询所有数据（兼容版本，需手动指定泛型）
     * @template T - 返回类型
     */
    getAll<T = any>(options: Omit<QueryOptions, "page" | "limit">): Promise<AllResult<T>>;

    /**
     * 插入数据（兼容版本）
     */
    insData(options: InsertOptions): Promise<number>;

    /**
     * 更新数据（兼容版本）
     */
    updData(options: UpdateOptions): Promise<number>;

    /**
     * 删除数据（兼容版本）
     */
    delData(options: DeleteOptions): Promise<number>;

    // ============================================
    // 通用方法
    // ============================================

    /**
     * 执行事务
     * @template T - 事务返回类型
     */
    trans<T = any>(callback: TransactionCallback<T>): Promise<T>;

    /**
     * 执行原始 SQL
     */
    query(sql: string, params?: any[]): Promise<any>;

    /**
     * 检查数据是否存在
     */
    exists(options: Omit<QueryOptions, "fields" | "orderBy" | "page" | "limit">): Promise<boolean>;

    /**
     * 检查表是否存在
     */
    tableExists(tableName: string): Promise<boolean>;

    /**
     * 批量插入数据
     */
    insBatch(table: string, dataList: Record<string, any>[]): Promise<number[]>;

    /**
     * 禁用数据（设置 state=2）
     */
    disableData(options: Omit<DeleteOptions, "hard">): Promise<number>;

    /**
     * 启用数据（设置 state=1）
     */
    enableData(options: Omit<DeleteOptions, "hard">): Promise<number>;

    /**
     * 硬删除数据（物理删除）
     */
    delForce(options: Omit<DeleteOptions, "hard">): Promise<number>;

    /**
     * 自增字段
     */
    increment(table: string, field: string, where: WhereConditions, value?: number): Promise<number>;

    /**
     * 自减字段
     */
    decrement(table: string, field: string, where: WhereConditions, value?: number): Promise<number>;

    /**
     * 查询单个字段值
     */
    getFieldValue<T = any>(options: Omit<QueryOptions, "fields"> & { field: string }): Promise<T | null>;
}

/**
 * SQL 客户端选项
 */
export interface SqlClientOptions {
    /** 最大连接数 */
    max?: number;
    /** 是否使用 BigInt */
    bigint?: boolean;
    /** 连接超时时间（毫秒），默认 30000ms */
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
    type: "length" | "comment" | "datatype" | "default";
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
    action: "create" | "drop";
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
