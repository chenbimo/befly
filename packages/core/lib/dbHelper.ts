/**
 * 数据库助手 - TypeScript 版本
 * 提供数据库 CRUD 操作的封装
 */

import type { WhereConditions, JoinOption, SqlValue } from "../types/common";
import type { QueryOptions, InsertOptions, UpdateOptions, DeleteOptions, DbPageResult, DbListResult, TransactionCallback, DbResult, SqlInfo, ListSql } from "../types/database";
import type { SqlRunResult } from "../utils/sqlUtil";

import { convertBigIntFields } from "../utils/convertBigIntFields";
import { fieldClear } from "../utils/fieldClear";
import { toNumberFromSql, toSqlParams } from "../utils/sqlUtil";
import { arrayKeysToCamel, isPlainObject, keysToCamel, snakeCase } from "../utils/util";
import { DbUtils } from "./dbUtils";
import { Logger } from "./logger";
import { SqlBuilder } from "./sqlBuilder";
import { SqlCheck } from "./sqlCheck";

type RedisCacheLike = {
    getObject<T = unknown>(key: string): Promise<T | null>;
    setObject<T = unknown>(key: string, obj: T, ttl?: number | null): Promise<string | null>;
    genTimeID(): Promise<number>;
};

type SqlClientLike = {
    unsafe<TResult = unknown>(sqlStr: string, params?: SqlValue[]): Promise<TResult>;
};

type SqlClientWithBeginLike = SqlClientLike & {
    begin<TResult>(callback: (tx: SqlClientLike) => Promise<TResult>): Promise<TResult>;
};

type DbIdMode = "timeId" | "autoId";

function quoteIdentMySql(identifier: string): string {
    if (typeof identifier !== "string") {
        throw new Error(`quoteIdentifier 需要字符串类型标识符 (identifier: ${String(identifier)})`);
    }

    const trimmed = identifier.trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
        throw new Error(`无效的 SQL 标识符: ${trimmed}`);
    }

    return `\`${trimmed}\``;
}

function hasBegin(sql: SqlClientLike): sql is SqlClientWithBeginLike {
    return typeof (sql as Partial<SqlClientWithBeginLike>).begin === "function";
}

class DbSqlError extends Error {
    public originalError: unknown;
    public params: SqlValue[];
    public duration: number;
    public sqlInfo: SqlInfo;

    public constructor(message: string, options: { originalError: unknown; params: SqlValue[]; duration: number; sqlInfo: SqlInfo }) {
        super(message);
        this.originalError = options.originalError;
        this.params = options.params;
        this.duration = options.duration;
        this.sqlInfo = options.sqlInfo;
    }
}

/**
 * 数据库助手类
 */
export class DbHelper {
    private redis: RedisCacheLike;
    private dbName: string;
    private sql: SqlClientLike | null = null;
    private isTransaction: boolean = false;
    private idMode: DbIdMode;

    /**
     * 构造函数
     * @param redis - Redis 实例
     * @param sql - Bun SQL 客户端（可选，用于事务）
     */
    constructor(options: { redis: RedisCacheLike; dbName: string; sql?: SqlClientLike | null; idMode?: DbIdMode }) {
        this.redis = options.redis;

        if (typeof options.dbName !== "string" || options.dbName.trim() === "") {
            throw new Error("DbHelper 初始化失败：dbName 必须为非空字符串");
        }
        this.dbName = options.dbName;

        this.sql = options.sql || null;
        this.isTransaction = Boolean(options.sql);

        // 默认保持历史行为：timeId
        this.idMode = options.idMode === "autoId" ? "autoId" : "timeId";
    }

    private createSqlBuilder(): SqlBuilder {
        return new SqlBuilder({ quoteIdent: quoteIdentMySql });
    }

    /**
     * 获取表的所有字段名
     * @param table - 表名（下划线格式）
     * @returns 字段名数组（下划线格式）
     */
    private async getTableColumns(table: string): Promise<string[]> {
        // 查询数据库
        const quotedTable = quoteIdentMySql(table);
        const execRes = await this.executeSelect(`SHOW COLUMNS FROM ${quotedTable}`, []);
        const result = execRes.data;

        if (!result || result.length === 0) {
            throw new Error(`表 ${table} 不存在或没有字段`);
        }

        const columnNames: string[] = [];
        for (const row of result) {
            const name = (row as Record<string, unknown>)["Field"];
            if (typeof name === "string" && name.length > 0) {
                columnNames.push(name);
            }
        }

        return columnNames;
    }

    /**
     * 统一的查询参数预处理方法
     */
    private async prepareQueryOptions(options: QueryOptions) {
        const cleanWhere = fieldClear(options.where || {}, { excludeValues: [null, undefined] });
        const hasJoins = options.joins && options.joins.length > 0;

        // 联查时使用特殊处理逻辑
        if (hasJoins) {
            // 联查时字段直接处理（支持表名.字段名格式）
            const processedFields = (options.fields || []).map((f) => DbUtils.processJoinField(f));

            const normalizedTableRef = DbUtils.normalizeTableRef(options.table);
            const mainQualifier = DbUtils.getJoinMainQualifier(options.table);

            return {
                table: normalizedTableRef,
                tableQualifier: mainQualifier,
                fields: processedFields.length > 0 ? processedFields : ["*"],
                where: DbUtils.processJoinWhere(cleanWhere),
                joins: options.joins,
                orderBy: DbUtils.processJoinOrderBy(options.orderBy || []),
                page: options.page || 1,
                limit: options.limit || 10
            };
        }

        // 单表查询使用原有逻辑
        const processedFields = await DbUtils.fieldsToSnake(snakeCase(options.table), options.fields || [], this.getTableColumns.bind(this));

        return {
            table: snakeCase(options.table),
            tableQualifier: snakeCase(options.table),
            fields: processedFields,
            where: DbUtils.whereKeysToSnake(cleanWhere),
            joins: undefined,
            orderBy: DbUtils.orderByToSnake(options.orderBy || []),
            page: options.page || 1,
            limit: options.limit || 10
        };
    }

    /**
     * 为 builder 添加 JOIN
     */
    private applyJoins(builder: SqlBuilder, joins?: JoinOption[]): void {
        if (!joins || joins.length === 0) return;

        for (const join of joins) {
            const processedTable = DbUtils.normalizeTableRef(join.table);
            const type = join.type || "left";

            switch (type) {
                case "inner":
                    builder.innerJoin(processedTable, join.on);
                    break;
                case "right":
                    builder.rightJoin(processedTable, join.on);
                    break;
                case "left":
                default:
                    builder.leftJoin(processedTable, join.on);
                    break;
            }
        }
    }

    private async executeSelect<TRow extends Record<string, unknown> = Record<string, unknown>>(sqlStr: string, params?: unknown[]): Promise<DbResult<TRow[]>> {
        return await this.executeWithConn<TRow[]>(sqlStr, params);
    }

    private async executeRun(sqlStr: string, params?: unknown[]): Promise<DbResult<SqlRunResult>> {
        return await this.executeWithConn<SqlRunResult>(sqlStr, params);
    }

    /**
     * 执行 SQL（使用 sql.unsafe）
     *
     * - DbHelper 不再负责打印 SQL 调试日志
     * - SQL 信息由调用方基于返回值中的 sql 自行输出
     */
    private async executeWithConn<TResult = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<TResult>> {
        if (!this.sql) {
            throw new Error("数据库连接未初始化");
        }

        // 强制类型检查：只接受字符串类型的 SQL
        if (typeof sqlStr !== "string") {
            throw new Error(`executeWithConn 只接受字符串类型的 SQL，收到类型: ${typeof sqlStr}，值: ${JSON.stringify(sqlStr)}`);
        }

        // 记录开始时间
        const startTime = Date.now();

        const safeParams: SqlValue[] = toSqlParams(params);

        try {
            // 使用 sql.unsafe 执行查询
            let result: TResult;
            if (safeParams.length > 0) {
                result = await this.sql.unsafe(sqlStr, safeParams);
            } else {
                result = await this.sql.unsafe(sqlStr);
            }

            // 计算执行时间
            const duration = Date.now() - startTime;

            const sql: SqlInfo = {
                sql: sqlStr,
                params: safeParams,
                duration: duration
            };

            return {
                data: result,
                sql: sql
            };
        } catch (error: unknown) {
            const duration = Date.now() - startTime;

            const msg = error instanceof Error ? error.message : String(error);

            throw new DbSqlError(`SQL执行失败: ${msg}`, {
                originalError: error,
                params: safeParams,
                duration: duration,
                sqlInfo: {
                    sql: sqlStr,
                    params: safeParams,
                    duration: duration
                }
            });
        }
    }

    /**
     * 执行原生 SQL（内部工具/同步脚本专用）
     *
     * - 复用当前 DbHelper 持有的连接/事务
     * - 统一走 executeWithConn，保持参数校验与错误行为一致
     */
    public async unsafe<TResult = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<TResult>> {
        return await this.executeWithConn<TResult>(sqlStr, params);
    }

    /**
     * 检查表是否存在
     * @param tableName - 表名（支持小驼峰，会自动转换为下划线）
     * @returns 表是否存在
     */
    async tableExists(tableName: string): Promise<DbResult<boolean>> {
        // 将表名转换为下划线格式
        const snakeTableName = snakeCase(tableName);

        const execRes = await this.executeSelect<{ count: number }>("SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", [snakeTableName]);
        const exists = (execRes.data?.[0]?.count || 0) > 0;

        return {
            data: exists,
            sql: execRes.sql
        };
    }

    /**
     * 查询记录数
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     * @param options.where - 查询条件
     * @param options.joins - 多表联查选项
     * @example
     * // 查询总数
     * const count = await db.getCount({ table: 'user' });
     * // 查询指定条件的记录数
     * const activeCount = await db.getCount({ table: 'user', where: { state: 1 } });
     * // 联查计数
     * const count = await db.getCount({
     *     table: 'order o',
     *     joins: [{ table: 'user u', on: 'o.user_id = u.id' }],
     *     where: { 'o.state': 1 }
     * });
     */
    async getCount(options: Omit<QueryOptions, "fields" | "page" | "limit" | "orderBy">): Promise<DbResult<number>> {
        const { table, where, joins, tableQualifier } = await this.prepareQueryOptions(options as QueryOptions);
        const hasJoins = Array.isArray(joins) && joins.length > 0;

        const builder = this.createSqlBuilder()
            .selectRaw("COUNT(*) as count")
            .from(table)
            .where(DbUtils.addDefaultStateFilter(where, tableQualifier, hasJoins));

        // 添加 JOIN
        this.applyJoins(builder, joins);

        const { sql, params } = builder.toSelectSql();
        const execRes = await this.executeSelect<{ count: number }>(sql, params);
        const count = execRes.data?.[0]?.count || 0;

        return {
            data: count,
            sql: execRes.sql
        };
    }

    /**
     * 查询单条数据
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换；联查时可带别名如 'order o'）
     * @param options.fields - 字段列表（联查时需带表别名，如 'o.id', 'u.username'）
     * @param options.joins - 多表联查选项
     * @returns DbResult<TItem>
     *
     * 语义说明（重要）：
     * - 本方法不再用 `null` 表示“未命中”。
     * - 当查询未命中（或数据反序列化失败）时，`data` 将返回空对象 `{}`。
     * - 因此业务侧应通过关键字段判断是否存在（例如 `if (!res.data?.id) { ... }`）。
     * @example
     * // 单表查询
     * getOne({ table: 'userProfile', fields: ['userId', 'userName'] })
     * // 联查
     * getOne({
     *     table: 'order o',
     *     joins: [{ table: 'user u', on: 'o.user_id = u.id' }],
     *     fields: ['o.id', 'o.totalAmount', 'u.username'],
     *     where: { 'o.id': 1 }
     * })
     */
    async getOne<TItem extends Record<string, unknown> = Record<string, unknown>>(options: QueryOptions): Promise<DbResult<TItem>> {
        const { table, fields, where, joins, tableQualifier } = await this.prepareQueryOptions(options);
        const hasJoins = Array.isArray(joins) && joins.length > 0;

        const builder = this.createSqlBuilder()
            .select(fields)
            .from(table)
            .where(DbUtils.addDefaultStateFilter(where, tableQualifier, hasJoins));

        // 添加 JOIN
        this.applyJoins(builder, joins);

        const { sql, params } = builder.toSelectSql();
        const execRes = await this.executeSelect(sql, params);
        const result = execRes.data;

        // 字段名转换：下划线 → 小驼峰
        const row = result?.[0] || null;
        if (!row) {
            return {
                data: {} as TItem,
                sql: execRes.sql
            };
        }

        const camelRow = keysToCamel<TItem>(row);

        // 反序列化数组字段（JSON 字符串 → 数组）
        const deserialized = DbUtils.deserializeArrayFields<TItem>(camelRow);
        if (!deserialized) {
            return {
                data: {} as TItem,
                sql: execRes.sql
            };
        }

        // 转换 BIGINT 字段（id, pid 等）为数字类型
        const convertedList = convertBigIntFields<TItem>([deserialized]);
        const data = convertedList[0] ?? deserialized;
        return {
            data: data,
            sql: execRes.sql
        };
    }

    /**
     * 语义化别名：getDetail（与 getOne 一致）
     *
     * 说明：Befly 早期业务侧习惯用 getDetail 表达“查详情”；这里不引入新的查询逻辑，直接复用 getOne。
     *
     * 语义说明：与 getOne 完全一致，未命中时 `data` 返回 `{}`。
     */
    async getDetail<TItem extends Record<string, unknown> = Record<string, unknown>>(options: QueryOptions): Promise<DbResult<TItem>> {
        return await this.getOne<TItem>(options);
    }

    /**
     * 查询列表（带分页）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换；联查时可带别名）
     * @param options.fields - 字段列表（联查时需带表别名）
     * @param options.joins - 多表联查选项
     * @example
     * // 单表分页
     * getList({ table: 'userProfile', fields: ['userId', 'userName', 'createdAt'] })
     * // 联查分页
     * getList({
     *     table: 'order o',
     *     joins: [
     *         { table: 'user u', on: 'o.user_id = u.id' },
     *         { table: 'product p', on: 'o.product_id = p.id' }
     *     ],
     *     fields: ['o.id', 'o.totalAmount', 'u.username', 'p.name AS productName'],
     *     where: { 'o.status': 'paid' },
     *     orderBy: ['o.createdAt#DESC'],
     *     page: 1,
     *     limit: 10
     * })
     */
    async getList<TItem extends Record<string, unknown> = Record<string, unknown>>(options: QueryOptions): Promise<DbResult<DbPageResult<TItem>, ListSql>> {
        const prepared = await this.prepareQueryOptions(options);

        // 参数上限校验
        if (prepared.page < 1 || prepared.page > 10000) {
            throw new Error(`页码必须在 1 到 10000 之间 (table: ${options.table}, page: ${prepared.page}, limit: ${prepared.limit})`);
        }
        if (prepared.limit < 1 || prepared.limit > 1000) {
            throw new Error(`每页数量必须在 1 到 1000 之间 (table: ${options.table}, page: ${prepared.page}, limit: ${prepared.limit})`);
        }

        // 构建查询
        const whereFiltered = DbUtils.addDefaultStateFilter(prepared.where, prepared.tableQualifier, Array.isArray(prepared.joins) && prepared.joins.length > 0);

        // 查询总数
        const countBuilder = this.createSqlBuilder().selectRaw("COUNT(*) as total").from(prepared.table).where(whereFiltered);

        // 添加 JOIN（计数也需要）
        this.applyJoins(countBuilder, prepared.joins);

        const { sql: countSql, params: countParams } = countBuilder.toSelectSql();
        const countExecRes = await this.executeSelect<{ total: number }>(countSql, countParams);
        const total = countExecRes.data?.[0]?.total || 0;

        // 如果总数为 0，直接返回，不执行第二次查询
        if (total === 0) {
            return {
                data: {
                    lists: [],
                    total: 0,
                    page: prepared.page,
                    limit: prepared.limit,
                    pages: 0
                },
                sql: {
                    count: countExecRes.sql
                }
            };
        }

        // 查询数据
        const offset = (prepared.page - 1) * prepared.limit;
        const dataBuilder = this.createSqlBuilder().select(prepared.fields).from(prepared.table).where(whereFiltered).limit(prepared.limit).offset(offset);

        // 添加 JOIN
        this.applyJoins(dataBuilder, prepared.joins);

        // 只有用户明确指定了 orderBy 才添加排序
        if (prepared.orderBy && prepared.orderBy.length > 0) {
            dataBuilder.orderBy(prepared.orderBy);
        }

        const { sql: dataSql, params: dataParams } = dataBuilder.toSelectSql();
        const dataExecRes = await this.executeSelect(dataSql, dataParams);
        const list = dataExecRes.data || [];

        // 字段名转换：下划线 → 小驼峰
        const camelList = arrayKeysToCamel<TItem>(list);

        // 反序列化数组字段
        const deserializedList = camelList.map((item) => DbUtils.deserializeArrayFields<TItem>(item)).filter((item): item is TItem => item !== null);

        // 转换 BIGINT 字段（id, pid 等）为数字类型
        return {
            data: {
                lists: convertBigIntFields<TItem>(deserializedList),
                total: total,
                page: prepared.page,
                limit: prepared.limit,
                pages: Math.ceil(total / prepared.limit)
            },
            sql: {
                count: countExecRes.sql,
                data: dataExecRes.sql
            }
        };
    }

    /**
     * 查询所有数据（不分页，有上限保护）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换；联查时可带别名）
     * @param options.fields - 字段列表（联查时需带表别名）
     * @param options.joins - 多表联查选项
     * ⚠️ 警告：此方法会查询大量数据，建议使用 getList 分页查询
     * @example
     * // 单表查询
     * getAll({ table: 'userProfile', fields: ['userId', 'userName'] })
     * // 联查
     * getAll({
     *     table: 'order o',
     *     joins: [{ table: 'user u', on: 'o.user_id = u.id' }],
     *     fields: ['o.id', 'u.username'],
     *     where: { 'o.state': 1 }
     * })
     */
    async getAll<TItem extends Record<string, unknown> = Record<string, unknown>>(options: Omit<QueryOptions, "page" | "limit">): Promise<DbResult<DbListResult<TItem>, ListSql>> {
        // 添加硬性上限保护，防止内存溢出
        const MAX_LIMIT = 10000;
        const WARNING_LIMIT = 1000;

        const prepareOptions: QueryOptions = {
            table: options.table,
            page: 1,
            limit: 10
        };
        if (options.fields !== undefined) prepareOptions.fields = options.fields;
        if (options.where !== undefined) prepareOptions.where = options.where;
        if (options.joins !== undefined) prepareOptions.joins = options.joins;
        if (options.orderBy !== undefined) prepareOptions.orderBy = options.orderBy;

        const prepared = await this.prepareQueryOptions(prepareOptions);

        const whereFiltered = DbUtils.addDefaultStateFilter(prepared.where, prepared.tableQualifier, Array.isArray(prepared.joins) && prepared.joins.length > 0);

        // 查询真实总数
        const countBuilder = this.createSqlBuilder().selectRaw("COUNT(*) as total").from(prepared.table).where(whereFiltered);

        // 添加 JOIN（计数也需要）
        this.applyJoins(countBuilder, prepared.joins);

        const { sql: countSql, params: countParams } = countBuilder.toSelectSql();
        const countExecRes = await this.executeSelect<{ total: number }>(countSql, countParams);
        const total = countExecRes.data?.[0]?.total || 0;

        // 如果总数为 0，直接返回
        if (total === 0) {
            return {
                data: {
                    lists: [],
                    total: 0
                },
                sql: {
                    count: countExecRes.sql
                }
            };
        }

        // 查询数据（受上限保护）
        const dataBuilder = this.createSqlBuilder().select(prepared.fields).from(prepared.table).where(whereFiltered).limit(MAX_LIMIT);

        // 添加 JOIN
        this.applyJoins(dataBuilder, prepared.joins);

        if (prepared.orderBy && prepared.orderBy.length > 0) {
            dataBuilder.orderBy(prepared.orderBy);
        }

        const { sql: dataSql, params: dataParams } = dataBuilder.toSelectSql();
        const dataExecRes = await this.executeSelect(dataSql, dataParams);
        const result = dataExecRes.data || [];

        // 警告日志：返回数据超过警告阈值
        if (result.length >= WARNING_LIMIT) {
            Logger.warn({ table: options.table, count: result.length, total: total, msg: "getAll 返回数据过多，建议使用 getList 分页查询" });
        }

        // 如果达到上限，额外警告
        if (result.length >= MAX_LIMIT) {
            Logger.warn({ table: options.table, limit: MAX_LIMIT, total: total, msg: `getAll 达到最大限制 ${MAX_LIMIT}，实际总数 ${total}，只返回前 ${MAX_LIMIT} 条` });
        }

        // 字段名转换：下划线 → 小驼峰
        const camelResult = arrayKeysToCamel<TItem>(result);

        // 反序列化数组字段
        const deserializedList = camelResult.map((item) => DbUtils.deserializeArrayFields<TItem>(item)).filter((item): item is TItem => item !== null);

        // 转换 BIGINT 字段（id, pid 等）为数字类型
        const lists = convertBigIntFields<TItem>(deserializedList);

        return {
            data: {
                lists: lists,
                total: total
            },
            sql: {
                count: countExecRes.sql,
                data: dataExecRes.sql
            }
        };
    }

    /**
     * 插入数据（自动生成 ID、时间戳、state）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async insData<TInsert extends Record<string, SqlValue> = Record<string, SqlValue>>(options: Omit<InsertOptions, "data"> & { data: TInsert }): Promise<DbResult<number>> {
        const { table, data } = options;

        const snakeTable = snakeCase(table);

        const now = Date.now();

        let processed: Record<string, any>;
        if (this.idMode === "autoId") {
            processed = DbUtils.buildInsertRow({ idMode: "autoId", data: data as any, now: now });
        } else {
            let id: number;
            try {
                id = await this.redis.genTimeID();
            } catch (error: any) {
                throw new Error(`生成 ID 失败，Redis 可能不可用 (table: ${table})`, { cause: error });
            }
            processed = DbUtils.buildInsertRow({ idMode: "timeId", data: data as any, id: id, now: now });
        }

        // 入口校验：保证进入 SqlBuilder 的数据无 undefined
        SqlCheck.assertNoUndefinedInRecord(processed, `insData 插入数据 (table: ${snakeTable})`);

        // 构建 SQL
        const builder = this.createSqlBuilder();
        const { sql, params } = builder.toInsertSql(snakeTable, processed);

        // 执行
        const execRes = await this.executeRun(sql, params);

        const processedId = processed["id"];
        const processedIdNum = typeof processedId === "number" ? processedId : 0;
        const lastInsertRowidNum = toNumberFromSql(execRes.data?.lastInsertRowid);

        // timeId：优先返回显式写入的 id；autoId：依赖 lastInsertRowid
        const insertedId = this.idMode === "autoId" ? lastInsertRowidNum || 0 : processedIdNum || lastInsertRowidNum || 0;
        if (this.idMode === "autoId" && insertedId <= 0) {
            throw new Error(`插入失败：autoId 模式下无法获取 lastInsertRowid (table: ${table})`);
        }
        return {
            data: insertedId,
            sql: execRes.sql
        };
    }

    /**
     * 批量插入数据（真正的批量操作）
     * 使用 INSERT INTO ... VALUES (...), (...), (...) 语法
     * 自动生成系统字段并包装在事务中
     * @param table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async insBatch<TInsert extends Record<string, SqlValue> = Record<string, SqlValue>>(table: string, dataList: TInsert[]): Promise<DbResult<number[]>> {
        // 空数组直接返回
        if (dataList.length === 0) {
            const sql: SqlInfo = { sql: "", params: [], duration: 0 };
            return {
                data: [],
                sql: sql
            };
        }

        // 限制批量大小
        const MAX_BATCH_SIZE = 1000;
        if (dataList.length > MAX_BATCH_SIZE) {
            throw new Error(`批量插入数量 ${dataList.length} 超过最大限制 ${MAX_BATCH_SIZE}`);
        }

        // 转换表名：小驼峰 → 下划线
        const snakeTable = snakeCase(table);

        const now = Date.now();

        // 处理所有数据（自动添加系统字段）
        let ids: number[] = [];

        let processedList: Record<string, any>[];
        if (this.idMode === "autoId") {
            processedList = dataList.map((data) => {
                return DbUtils.buildInsertRow({ idMode: "autoId", data: data as any, now: now });
            });
        } else {
            // 批量生成 ID（逐个获取）
            const nextIds: number[] = [];
            for (let i = 0; i < dataList.length; i++) {
                nextIds.push(await this.redis.genTimeID());
            }
            ids = nextIds;
            processedList = dataList.map((data, index) => {
                const id = nextIds[index];
                if (typeof id !== "number") {
                    throw new Error(`批量插入生成 ID 失败：ids[${index}] 不是 number (table: ${snakeTable})`);
                }
                return DbUtils.buildInsertRow({ idMode: "timeId", data: data as any, id: id, now: now });
            });
        }

        // 入口校验：保证进入 SqlBuilder 的批量数据结构一致且无 undefined
        const insertFields = SqlCheck.assertBatchInsertRowsConsistent(processedList, { table: snakeTable });

        // 构建批量插入 SQL
        const builder = this.createSqlBuilder();
        const { sql, params } = builder.toInsertSql(snakeTable, processedList);

        // 在事务中执行批量插入
        try {
            const execRes = await this.executeRun(sql, params);

            if (this.idMode === "autoId") {
                const firstId = toNumberFromSql(execRes.data?.lastInsertRowid);
                if (firstId <= 0) {
                    throw new Error(`批量插入失败：autoId 模式下无法获取 lastInsertRowid (table: ${table})`);
                }

                // 说明：这里假设 auto_increment_increment = 1（默认）。
                // 如需支持非 1，请在此处增加查询 @@auto_increment_increment 并调整推导规则。
                const outIds: number[] = [];
                for (let i = 0; i < dataList.length; i++) {
                    outIds.push(firstId + i);
                }

                return {
                    data: outIds,
                    sql: execRes.sql
                };
            }

            return {
                data: ids,
                sql: execRes.sql
            };
        } catch (error: any) {
            Logger.error({
                err: error,
                table: table,
                snakeTable: snakeTable,
                count: dataList.length,
                fields: insertFields,
                msg: "批量插入失败"
            });
            throw error;
        }
    }

    async delForceBatch(table: string, ids: number[]): Promise<DbResult<number>> {
        if (ids.length === 0) {
            const sql: SqlInfo = { sql: "", params: [], duration: 0 };
            return {
                data: 0,
                sql: sql
            };
        }

        const snakeTable = snakeCase(table);

        const query = SqlBuilder.toDeleteInSql({
            table: snakeTable,
            idField: "id",
            ids: ids,
            quoteIdent: quoteIdentMySql
        });
        const execRes = await this.executeRun(query.sql, query.params);
        const changes = toNumberFromSql(execRes.data?.changes);
        return {
            data: changes,
            sql: execRes.sql
        };
    }

    async updBatch(table: string, dataList: Array<{ id: number; data: Record<string, unknown> }>): Promise<DbResult<number>> {
        if (dataList.length === 0) {
            const sql: SqlInfo = { sql: "", params: [], duration: 0 };
            return {
                data: 0,
                sql: sql
            };
        }

        const snakeTable = snakeCase(table);
        const now = Date.now();

        const processedList: Array<{ id: number; data: Record<string, any> }> = [];
        const fieldSet = new Set<string>();

        for (const item of dataList) {
            const userData = DbUtils.buildPartialUpdateData({ data: item.data, allowState: true });

            for (const key of Object.keys(userData)) {
                fieldSet.add(key);
            }

            processedList.push({ id: item.id, data: userData });
        }

        const fields = Array.from(fieldSet).sort();
        if (fields.length === 0) {
            const sql: SqlInfo = { sql: "", params: [], duration: 0 };
            return {
                data: 0,
                sql: sql
            };
        }

        const query = SqlBuilder.toUpdateCaseByIdSql({
            table: snakeTable,
            idField: "id",
            rows: processedList,
            fields: fields,
            quoteIdent: quoteIdentMySql,
            updatedAtField: "updated_at",
            updatedAtValue: now,
            stateField: "state",
            stateGtZero: true
        });

        const execRes = await this.executeRun(query.sql, query.params);
        const changes = toNumberFromSql(execRes.data?.changes);
        return {
            data: changes,
            sql: execRes.sql
        };
    }

    /**
     * 更新数据（强制更新时间戳，系统字段不可修改）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async updData(options: UpdateOptions): Promise<DbResult<number>> {
        const { table, data, where } = options;

        // 清理条件（排除 null 和 undefined）
        const cleanWhere = fieldClear(where, { excludeValues: [null, undefined] });

        // 转换表名：小驼峰 → 下划线
        const snakeTable = snakeCase(table);
        const snakeWhere = DbUtils.whereKeysToSnake(cleanWhere);

        const processed = DbUtils.buildUpdateRow({ data: data, now: Date.now(), allowState: true });

        // 构建 SQL
        const whereFiltered = DbUtils.addDefaultStateFilter(snakeWhere, snakeTable, false);
        const builder = this.createSqlBuilder().where(whereFiltered);
        const { sql, params } = builder.toUpdateSql(snakeTable, processed);

        // 执行
        const execRes = await this.executeRun(sql, params);
        const changes = toNumberFromSql(execRes.data?.changes);
        return {
            data: changes,
            sql: execRes.sql
        };
    }

    /**
     * 软删除数据（deleted_at 设置为当前时间，state 设置为 0）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async delData(options: DeleteOptions): Promise<DbResult<number>> {
        const { table, where } = options;

        return await this.updData({
            table: table,
            data: { state: 0, deleted_at: Date.now() },
            where: where
        });
    }

    /**
     * 硬删除数据（物理删除，不可恢复）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async delForce(options: Omit<DeleteOptions, "hard">): Promise<DbResult<number>> {
        const { table, where } = options;

        // 转换表名：小驼峰 → 下划线
        const snakeTable = snakeCase(table);

        // 清理条件字段
        const cleanWhere = fieldClear(where, { excludeValues: [null, undefined] });
        const snakeWhere = DbUtils.whereKeysToSnake(cleanWhere);

        // 物理删除
        const builder = this.createSqlBuilder().where(snakeWhere);
        const { sql, params } = builder.toDeleteSql(snakeTable);

        const execRes = await this.executeRun(sql, params);
        const changes = toNumberFromSql(execRes.data?.changes);
        return {
            data: changes,
            sql: execRes.sql
        };
    }

    /**
     * 禁用数据（设置 state=2）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async disableData(options: Omit<DeleteOptions, "hard">): Promise<DbResult<number>> {
        const { table, where } = options;

        return await this.updData({
            table: table,
            data: {
                state: 2
            },
            where: where
        });
    }

    /**
     * 启用数据（设置 state=1）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async enableData(options: Omit<DeleteOptions, "hard">): Promise<DbResult<number>> {
        const { table, where } = options;

        return await this.updData({
            table: table,
            data: {
                state: 1
            },
            where: where
        });
    }

    /**
     * 执行事务
     * 使用 Bun SQL 的 begin 方法开启事务
     */
    async trans<TResult = unknown>(callback: TransactionCallback<TResult, DbHelper>): Promise<TResult> {
        if (this.isTransaction) {
            // 已经在事务中，直接执行回调
            return await callback(this);
        }

        const sql = this.sql;
        if (!sql) {
            throw new Error("数据库连接未初始化");
        }
        if (!hasBegin(sql)) {
            throw new Error("当前 SQL 客户端不支持事务 begin() 方法");
        }

        // 使用 Bun SQL 的 begin 方法开启事务
        // begin 方法会自动处理 commit/rollback
        return await sql.begin(async (tx: SqlClientLike) => {
            const trans = new DbHelper({ redis: this.redis, dbName: this.dbName, sql: tx, idMode: this.idMode });
            return await callback(trans);
        });
    }

    /**
     * 执行原始 SQL
     */
    async query<TResult = unknown>(sql: string, params?: unknown[]): Promise<DbResult<TResult>> {
        return await this.executeWithConn<TResult>(sql, params);
    }

    /**
     * 检查数据是否存在（优化性能）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async exists(options: Omit<QueryOptions, "fields" | "orderBy" | "page" | "limit">): Promise<DbResult<boolean>> {
        if (Array.isArray(options.joins) && options.joins.length > 0) {
            throw new Error("exists 不支持 joins（请使用显式 query 或拆分查询）");
        }

        const rawTable = typeof options.table === "string" ? options.table.trim() : "";
        if (!rawTable) {
            throw new Error("exists.table 不能为空");
        }
        if (rawTable.includes(" ")) {
            throw new Error(`exists 不支持别名表写法（table: ${rawTable}）`);
        }
        if (rawTable.includes(".")) {
            throw new Error(`exists 不支持 schema.table 写法（table: ${rawTable}）`);
        }

        const snakeTable = snakeCase(rawTable);
        const cleanWhere = fieldClear(options.where || {}, { excludeValues: [null, undefined] });
        const snakeWhere = DbUtils.whereKeysToSnake(cleanWhere);
        const whereFiltered = DbUtils.addDefaultStateFilter(snakeWhere, snakeTable, false);

        // 使用 COUNT(1) 实现：语义清晰、适配现有返回结构
        const builder = this.createSqlBuilder().selectRaw("COUNT(1) as cnt").from(snakeTable).where(whereFiltered).limit(1);
        const { sql, params } = builder.toSelectSql();
        const execRes = await this.executeSelect<{ cnt: number }>(sql, params);
        const exists = (execRes.data?.[0]?.cnt || 0) > 0;
        return { data: exists, sql: execRes.sql };
    }

    /**
     * 查询单个字段值（带字段名验证）
     * @param field - 字段名（支持小驼峰或下划线格式）
     */
    async getFieldValue<TValue = unknown>(options: Omit<QueryOptions, "fields"> & { field: string }): Promise<DbResult<TValue | null>> {
        const field = options.field;

        if (Array.isArray(options.joins) && options.joins.length > 0) {
            throw new Error("getFieldValue 不支持 joins（请使用 getOne/getList 并自行取字段）");
        }

        const rawTable = typeof options.table === "string" ? options.table.trim() : "";
        if (!rawTable) {
            throw new Error("getFieldValue.table 不能为空");
        }
        if (rawTable.includes(" ")) {
            throw new Error(`getFieldValue 不支持别名表写法（table: ${rawTable}）`);
        }
        if (rawTable.includes(".")) {
            throw new Error(`getFieldValue 不支持 schema.table 写法（table: ${rawTable}）`);
        }
        // （其余逻辑保持不变）

        // 验证字段名格式（只允许字母、数字、下划线）
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
            throw new Error(`无效的字段名: ${field}，只允许字母、数字和下划线`);
        }

        const oneOptions: QueryOptions = {
            table: options.table
        };
        if (options.where !== undefined) oneOptions.where = options.where;
        if (options.joins !== undefined) oneOptions.joins = options.joins;
        if (options.orderBy !== undefined) oneOptions.orderBy = options.orderBy;
        if (options.page !== undefined) oneOptions.page = options.page;
        if (options.limit !== undefined) oneOptions.limit = options.limit;
        oneOptions.fields = [field];

        const oneRes = await this.getOne<Record<string, unknown>>(oneOptions);

        const result = oneRes.data;
        if (!isPlainObject(result)) {
            return {
                data: null,
                sql: oneRes.sql
            };
        }

        // 尝试直接访问字段（小驼峰）
        if (Object.hasOwn(result, field)) {
            return {
                data: result[field] as TValue,
                sql: oneRes.sql
            };
        }

        // 转换为小驼峰格式再尝试访问（支持用户传入下划线格式）
        const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (camelField !== field && Object.hasOwn(result, camelField)) {
            return {
                data: result[camelField] as TValue,
                sql: oneRes.sql
            };
        }

        // 转换为下划线格式再尝试访问（支持用户传入小驼峰格式）
        const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        if (snakeField !== field && Object.hasOwn(result, snakeField)) {
            return {
                data: result[snakeField] as TValue,
                sql: oneRes.sql
            };
        }

        return {
            data: null,
            sql: oneRes.sql
        };
    }

    /**
     * 自增字段（安全实现，防止 SQL 注入）
     * @param table - 表名（支持小驼峰或下划线格式，会自动转换）
     * @param field - 字段名（支持小驼峰或下划线格式，会自动转换）
     */
    async increment(table: string, field: string, where: WhereConditions, value: number = 1): Promise<DbResult<number>> {
        // 转换表名和字段名：小驼峰 → 下划线
        const snakeTable = snakeCase(table);
        const snakeField = snakeCase(field);

        // 验证表名格式（只允许字母、数字、下划线）
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(snakeTable)) {
            throw new Error(`无效的表名: ${snakeTable}`);
        }

        // 验证字段名格式（只允许字母、数字、下划线）
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(snakeField)) {
            throw new Error(`无效的字段名: ${field}`);
        }

        // 验证 value 必须是数字
        if (typeof value !== "number" || isNaN(value)) {
            throw new Error(`自增值必须是有效的数字 (table: ${table}, field: ${field}, value: ${value})`);
        }

        // 清理 where 条件（排除 null 和 undefined）
        const cleanWhere = fieldClear(where, { excludeValues: [null, undefined] });

        // 转换 where 条件字段名：小驼峰 → 下划线
        const snakeWhere = DbUtils.whereKeysToSnake(cleanWhere);

        // 使用 SqlBuilder 构建安全的 WHERE 条件
        const whereFiltered = DbUtils.addDefaultStateFilter(snakeWhere, snakeTable, false);
        const builder = this.createSqlBuilder().where(whereFiltered);
        const { sql: whereClause, params: whereParams } = builder.getWhereConditions();

        // 构建安全的 UPDATE SQL（表名和字段名使用反引号转义，已经是下划线格式）
        const quotedTable = quoteIdentMySql(snakeTable);
        const quotedField = quoteIdentMySql(snakeField);
        const sql = whereClause ? `UPDATE ${quotedTable} SET ${quotedField} = ${quotedField} + ? WHERE ${whereClause}` : `UPDATE ${quotedTable} SET ${quotedField} = ${quotedField} + ?`;

        const execRes = await this.executeRun(sql, [value, ...whereParams]);
        const changes = toNumberFromSql(execRes.data?.changes);
        return {
            data: changes,
            sql: execRes.sql
        };
    }

    /**
     * 自减字段
     * @param table - 表名（支持小驼峰或下划线格式，会自动转换）
     * @param field - 字段名（支持小驼峰或下划线格式，会自动转换）
     */
    async decrement(table: string, field: string, where: WhereConditions, value: number = 1): Promise<DbResult<number>> {
        return await this.increment(table, field, where, -value);
    }
}
