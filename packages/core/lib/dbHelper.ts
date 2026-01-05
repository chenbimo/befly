/**
 * 数据库助手 - TypeScript 版本
 * 提供数据库 CRUD 操作的封装
 */

import type { WhereConditions, JoinOption } from "../types/common";
import type { QueryOptions, InsertOptions, UpdateOptions, DeleteOptions, ListResult, AllResult, TransactionCallback, DbResult, SqlInfo, ListSql } from "../types/database";
import type { DbDialect } from "./dbDialect";

import { arrayKeysToCamel } from "../utils/arrayKeysToCamel";
import { convertBigIntFields } from "../utils/convertBigIntFields";
import { fieldClear } from "../utils/fieldClear";
import { keysToCamel } from "../utils/keysToCamel";
import { snakeCase } from "../utils/snakeCase";
import { CacheKeys } from "./cacheKeys";
import { MySqlDialect } from "./dbDialect";
import { DbUtils } from "./dbUtils";
import { Logger } from "./logger";
import { SqlBuilder } from "./sqlBuilder";
import { SqlCheck } from "./sqlCheck";

const TABLE_COLUMNS_CACHE_TTL_SECONDS = 3600;

type RedisCacheLike = {
    getObject<T = any>(key: string): Promise<T | null>;
    setObject<T = any>(key: string, obj: T, ttl?: number | null): Promise<string | null>;
    genTimeID(): Promise<number>;
};

/**
 * 数据库助手类
 */
export class DbHelper {
    private redis: RedisCacheLike;
    private dialect: DbDialect;
    private sql: any = null;
    private isTransaction: boolean = false;

    /**
     * 构造函数
     * @param redis - Redis 实例
     * @param sql - Bun SQL 客户端（可选，用于事务）
     */
    constructor(options: { redis: RedisCacheLike; sql?: any | null; dialect?: DbDialect }) {
        this.redis = options.redis;
        this.sql = options.sql || null;
        this.isTransaction = !!options.sql;

        // 默认使用 MySQL 方言（当前 core 的表结构/语法也主要基于 MySQL）
        this.dialect = options.dialect ? options.dialect : new MySqlDialect();
    }

    private createSqlBuilder(): SqlBuilder {
        return new SqlBuilder({ quoteIdent: this.dialect.quoteIdent.bind(this.dialect) });
    }

    /**
     * 获取表的所有字段名（Redis 缓存）
     * @param table - 表名（下划线格式）
     * @returns 字段名数组（下划线格式）
     */
    private async getTableColumns(table: string): Promise<string[]> {
        // 1. 先查 Redis 缓存
        const cacheKey = CacheKeys.tableColumns(table);
        const columns = await this.redis.getObject<string[]>(cacheKey);

        if (columns && columns.length > 0) {
            return columns;
        }

        // 2. 缓存未命中，查询数据库
        const query = this.dialect.getTableColumnsQuery(table);
        const execRes = await this.executeWithConn(query.sql, query.params);
        const result = execRes.data;

        if (!result || result.length === 0) {
            throw new Error(`表 ${table} 不存在或没有字段`);
        }

        const columnNames = this.dialect.getTableColumnsFromResult(result);

        // 3. 写入 Redis 缓存
        const cacheRes = await this.redis.setObject(cacheKey, columnNames, TABLE_COLUMNS_CACHE_TTL_SECONDS);
        if (cacheRes === null) {
            Logger.warn({ table: table, cacheKey: cacheKey }, "表字段缓存写入 Redis 失败");
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
    /**
     * 执行 SQL（使用 sql.unsafe）
     *
     * - DbHelper 不再负责打印 SQL 调试日志
     * - SQL 信息由调用方基于返回值中的 sql 自行输出
     */
    private async executeWithConn(sqlStr: string, params?: any[]): Promise<DbResult<any>> {
        if (!this.sql) {
            throw new Error("数据库连接未初始化");
        }

        // 强制类型检查：只接受字符串类型的 SQL
        if (typeof sqlStr !== "string") {
            throw new Error(`executeWithConn 只接受字符串类型的 SQL，收到类型: ${typeof sqlStr}，值: ${JSON.stringify(sqlStr)}`);
        }

        // 记录开始时间
        const startTime = Date.now();

        const safeParams = Array.isArray(params) ? params : [];

        try {
            // 使用 sql.unsafe 执行查询
            let result;
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
        } catch (error: any) {
            const duration = Date.now() - startTime;

            const enhancedError: any = new Error(`SQL执行失败: ${error.message}`);
            enhancedError.originalError = error;
            enhancedError.params = safeParams;
            enhancedError.duration = duration;
            enhancedError.sqlInfo = {
                sql: sqlStr,
                params: safeParams,
                duration: duration
            };
            throw enhancedError;
        }
    }

    /**
     * 执行原生 SQL（内部工具/同步脚本专用）
     *
     * - 复用当前 DbHelper 持有的连接/事务
     * - 统一走 executeWithConn，保持参数校验与错误行为一致
     */
    public async unsafe(sqlStr: string, params?: any[]): Promise<DbResult<any>> {
        return await this.executeWithConn(sqlStr, params);
    }

    /**
     * 检查表是否存在
     * @param tableName - 表名（支持小驼峰，会自动转换为下划线）
     * @returns 表是否存在
     */
    async tableExists(tableName: string): Promise<DbResult<boolean>> {
        // 将表名转换为下划线格式
        const snakeTableName = snakeCase(tableName);

        const query = this.dialect.tableExistsQuery(snakeTableName);
        const execRes = await this.executeWithConn(query.sql, query.params);
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

        const builder = this.createSqlBuilder()
            .selectRaw("COUNT(*) as count")
            .from(table)
            .where(DbUtils.addDefaultStateFilter(where, tableQualifier, !!joins));

        // 添加 JOIN
        this.applyJoins(builder, joins);

        const { sql, params } = builder.toSelectSql();
        const execRes = await this.executeWithConn(sql, params);
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
    async getOne<T extends Record<string, any> = Record<string, any>>(options: QueryOptions): Promise<DbResult<T | null>> {
        const { table, fields, where, joins, tableQualifier } = await this.prepareQueryOptions(options);

        const builder = this.createSqlBuilder()
            .select(fields)
            .from(table)
            .where(DbUtils.addDefaultStateFilter(where, tableQualifier, !!joins));

        // 添加 JOIN
        this.applyJoins(builder, joins);

        const { sql, params } = builder.toSelectSql();
        const execRes = await this.executeWithConn(sql, params);
        const result = execRes.data;

        // 字段名转换：下划线 → 小驼峰
        const row = result?.[0] || null;
        if (!row) {
            return {
                data: null,
                sql: execRes.sql
            };
        }

        const camelRow = keysToCamel<T>(row);

        // 反序列化数组字段（JSON 字符串 → 数组）
        const deserialized = DbUtils.deserializeArrayFields<T>(camelRow);
        if (!deserialized) {
            return {
                data: null,
                sql: execRes.sql
            };
        }

        // 转换 BIGINT 字段（id, pid 等）为数字类型
        const data = convertBigIntFields<T>([deserialized])[0];
        return {
            data: data,
            sql: execRes.sql
        };
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
    async getList<T extends Record<string, any> = Record<string, any>>(options: QueryOptions): Promise<DbResult<ListResult<T>, ListSql>> {
        const prepared = await this.prepareQueryOptions(options);

        // 参数上限校验
        if (prepared.page < 1 || prepared.page > 10000) {
            throw new Error(`页码必须在 1 到 10000 之间 (table: ${options.table}, page: ${prepared.page}, limit: ${prepared.limit})`);
        }
        if (prepared.limit < 1 || prepared.limit > 1000) {
            throw new Error(`每页数量必须在 1 到 1000 之间 (table: ${options.table}, page: ${prepared.page}, limit: ${prepared.limit})`);
        }

        // 构建查询
        const whereFiltered = DbUtils.addDefaultStateFilter(prepared.where, prepared.tableQualifier, !!prepared.joins);

        // 查询总数
        const countBuilder = this.createSqlBuilder().selectRaw("COUNT(*) as total").from(prepared.table).where(whereFiltered);

        // 添加 JOIN（计数也需要）
        this.applyJoins(countBuilder, prepared.joins);

        const { sql: countSql, params: countParams } = countBuilder.toSelectSql();
        const countExecRes = await this.executeWithConn(countSql, countParams);
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
        const dataExecRes = await this.executeWithConn(dataSql, dataParams);
        const list = dataExecRes.data || [];

        // 字段名转换：下划线 → 小驼峰
        const camelList = arrayKeysToCamel<T>(list);

        // 反序列化数组字段
        const deserializedList = camelList.map((item) => DbUtils.deserializeArrayFields<T>(item)).filter((item): item is T => item !== null);

        // 转换 BIGINT 字段（id, pid 等）为数字类型
        return {
            data: {
                lists: convertBigIntFields<T>(deserializedList),
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
    async getAll<T extends Record<string, any> = Record<string, any>>(options: Omit<QueryOptions, "page" | "limit">): Promise<DbResult<AllResult<T>, ListSql>> {
        // 添加硬性上限保护，防止内存溢出
        const MAX_LIMIT = 10000;
        const WARNING_LIMIT = 1000;

        const prepared = await this.prepareQueryOptions({ ...options, page: 1, limit: 10 });

        const whereFiltered = DbUtils.addDefaultStateFilter(prepared.where, prepared.tableQualifier, !!prepared.joins);

        // 查询真实总数
        const countBuilder = this.createSqlBuilder().selectRaw("COUNT(*) as total").from(prepared.table).where(whereFiltered);

        // 添加 JOIN（计数也需要）
        this.applyJoins(countBuilder, prepared.joins);

        const { sql: countSql, params: countParams } = countBuilder.toSelectSql();
        const countExecRes = await this.executeWithConn(countSql, countParams);
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
        const dataExecRes = await this.executeWithConn(dataSql, dataParams);
        const result = dataExecRes.data || [];

        // 警告日志：返回数据超过警告阈值
        if (result.length >= WARNING_LIMIT) {
            Logger.warn({ table: options.table, count: result.length, total: total }, "getAll 返回数据过多，建议使用 getList 分页查询");
        }

        // 如果达到上限，额外警告
        if (result.length >= MAX_LIMIT) {
            Logger.warn({ table: options.table, limit: MAX_LIMIT, total: total }, `getAll 达到最大限制 ${MAX_LIMIT}，实际总数 ${total}，只返回前 ${MAX_LIMIT} 条`);
        }

        // 字段名转换：下划线 → 小驼峰
        const camelResult = arrayKeysToCamel<T>(result);

        // 反序列化数组字段
        const deserializedList = camelResult.map((item) => DbUtils.deserializeArrayFields<T>(item)).filter((item): item is T => item !== null);

        // 转换 BIGINT 字段（id, pid 等）为数字类型
        const lists = convertBigIntFields<T>(deserializedList);

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
    async insData(options: InsertOptions): Promise<DbResult<number>> {
        const { table, data } = options;

        const snakeTable = snakeCase(table);

        const now = Date.now();

        let id: number;
        try {
            id = await this.redis.genTimeID();
        } catch (error: any) {
            throw new Error(`生成 ID 失败，Redis 可能不可用 (table: ${table})`, { cause: error });
        }

        const processed = DbUtils.buildInsertRow({ data: data, id: id, now: now });

        // 入口校验：保证进入 SqlBuilder 的数据无 undefined
        SqlCheck.assertNoUndefinedInRecord(processed as any, `insData 插入数据 (table: ${snakeTable})`);

        // 构建 SQL
        const builder = this.createSqlBuilder();
        const { sql, params } = builder.toInsertSql(snakeTable, processed);

        // 执行
        const execRes = await this.executeWithConn(sql, params);
        const insertedId = processed.id || execRes.data?.lastInsertRowid || 0;
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
    async insBatch(table: string, dataList: Record<string, any>[]): Promise<DbResult<number[]>> {
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

        // 批量生成 ID（逐个获取）
        const ids: number[] = [];
        for (let i = 0; i < dataList.length; i++) {
            ids.push(await this.redis.genTimeID());
        }
        const now = Date.now();

        // 处理所有数据（自动添加系统字段）
        const processedList = dataList.map((data, index) => {
            return DbUtils.buildInsertRow({ data: data, id: ids[index], now: now });
        });

        // 入口校验：保证进入 SqlBuilder 的批量数据结构一致且无 undefined
        const insertFields = SqlCheck.assertBatchInsertRowsConsistent(processedList as any, { table: snakeTable });

        // 构建批量插入 SQL
        const builder = this.createSqlBuilder();
        const { sql, params } = builder.toInsertSql(snakeTable, processedList);

        // 在事务中执行批量插入
        try {
            const execRes = await this.executeWithConn(sql, params);
            return {
                data: ids,
                sql: execRes.sql
            };
        } catch (error: any) {
            Logger.error(
                {
                    err: error,
                    table: table,
                    snakeTable: snakeTable,
                    count: dataList.length,
                    fields: insertFields
                },
                "批量插入失败"
            );
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
            quoteIdent: this.dialect.quoteIdent.bind(this.dialect)
        });
        const execRes = await this.executeWithConn(query.sql, query.params);
        const changes = execRes.data?.changes || 0;
        return {
            data: changes,
            sql: execRes.sql
        };
    }

    async updBatch(table: string, dataList: Array<{ id: number; data: Record<string, any> }>): Promise<DbResult<number>> {
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
            quoteIdent: this.dialect.quoteIdent.bind(this.dialect),
            updatedAtField: "updated_at",
            updatedAtValue: now,
            stateField: "state",
            stateGtZero: true
        });

        const execRes = await this.executeWithConn(query.sql, query.params);
        const changes = execRes.data?.changes || 0;
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
        const execRes = await this.executeWithConn(sql, params);
        const changes = execRes.data?.changes || 0;
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

        const execRes = await this.executeWithConn(sql, params);
        const changes = execRes.data?.changes || 0;
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
    async trans<T = any>(callback: TransactionCallback<T>): Promise<T> {
        if (this.isTransaction) {
            // 已经在事务中，直接执行回调
            return await callback(this);
        }

        // 使用 Bun SQL 的 begin 方法开启事务
        // begin 方法会自动处理 commit/rollback
        return await this.sql.begin(async (tx: any) => {
            const trans = new DbHelper({ redis: this.redis, sql: tx, dialect: this.dialect });
            return await callback(trans);
        });
    }

    /**
     * 执行原始 SQL
     */
    async query(sql: string, params?: any[]): Promise<DbResult<any>> {
        return await this.executeWithConn(sql, params);
    }

    /**
     * 检查数据是否存在（优化性能）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async exists(options: Omit<QueryOptions, "fields" | "orderBy" | "page" | "limit">): Promise<DbResult<boolean>> {
        const { table, where, tableQualifier } = await this.prepareQueryOptions({ ...options, page: 1, limit: 1 } as any);

        // 使用 COUNT(1) 性能更好
        const builder = this.createSqlBuilder()
            .selectRaw("COUNT(1) as cnt")
            .from(table)
            .where(DbUtils.addDefaultStateFilter(where, tableQualifier, false))
            .limit(1);

        const { sql, params } = builder.toSelectSql();
        const execRes = await this.executeWithConn(sql, params);
        const exists = (execRes.data?.[0]?.cnt || 0) > 0;

        return {
            data: exists,
            sql: execRes.sql
        };
    }

    /**
     * 查询单个字段值（带字段名验证）
     * @param field - 字段名（支持小驼峰或下划线格式）
     */
    async getFieldValue<T = any>(options: Omit<QueryOptions, "fields"> & { field: string }): Promise<DbResult<T | null>> {
        const { field, ...queryOptions } = options;

        // 验证字段名格式（只允许字母、数字、下划线）
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
            throw new Error(`无效的字段名: ${field}，只允许字母、数字和下划线`);
        }

        const oneRes = await this.getOne({
            ...queryOptions,
            fields: [field]
        });

        const result = oneRes.data;
        if (!result) {
            return {
                data: null,
                sql: oneRes.sql
            };
        }

        // 尝试直接访问字段（小驼峰）
        if (field in result) {
            return {
                data: result[field],
                sql: oneRes.sql
            };
        }

        // 转换为小驼峰格式再尝试访问（支持用户传入下划线格式）
        const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (camelField !== field && camelField in result) {
            return {
                data: result[camelField],
                sql: oneRes.sql
            };
        }

        // 转换为下划线格式再尝试访问（支持用户传入小驼峰格式）
        const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        if (snakeField !== field && snakeField in result) {
            return {
                data: result[snakeField],
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
        const quotedTable = this.dialect.quoteIdent(snakeTable);
        const quotedField = this.dialect.quoteIdent(snakeField);
        const sql = whereClause ? `UPDATE ${quotedTable} SET ${quotedField} = ${quotedField} + ? WHERE ${whereClause}` : `UPDATE ${quotedTable} SET ${quotedField} = ${quotedField} + ?`;

        const execRes = await this.executeWithConn(sql, [value, ...whereParams]);
        const changes = execRes.data?.changes || 0;
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
