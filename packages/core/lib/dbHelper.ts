/**
 * 数据库助手 - TypeScript 版本
 * 提供数据库 CRUD 操作的封装
 */

import { snakeCase } from 'es-toolkit/string';
import { SqlBuilder } from './sqlBuilder.js';
import { keysToCamel } from 'befly-shared/keysToCamel';
import { arrayKeysToCamel } from 'befly-shared/arrayKeysToCamel';
import { keysToSnake } from 'befly-shared/keysToSnake';
import { fieldClear } from 'befly-shared/fieldClear';
import { RedisTTL, RedisKeys } from 'befly-shared/redisKeys';
import { Logger } from './logger.js';
import type { WhereConditions } from '../types/common.js';
import type { BeflyContext } from '../types/befly.js';
import type { QueryOptions, InsertOptions, UpdateOptions, DeleteOptions, ListResult, TransactionCallback } from '../types/database.js';

/**
 * 数据库助手类
 */
export class DbHelper {
    private befly: BeflyContext;
    private sql: any = null;
    private isTransaction: boolean = false;

    /**
     * 构造函数
     * @param befly - Befly 上下文
     * @param sql - Bun SQL 客户端（可选，用于事务）
     */
    constructor(befly: BeflyContext, sql: any = null) {
        this.befly = befly;
        this.sql = sql;
        this.isTransaction = !!sql;
    }

    /**
     * 验证 fields 格式并分类
     * @returns { type: 'all' | 'include' | 'exclude', fields: string[] }
     * @throws 如果 fields 格式非法
     */
    private validateAndClassifyFields(fields?: string[]): {
        type: 'all' | 'include' | 'exclude';
        fields: string[];
    } {
        // 情况1：空数组或 undefined，表示查询所有
        if (!fields || fields.length === 0) {
            return { type: 'all', fields: [] };
        }

        // 检测是否有星号（禁止）
        if (fields.some((f) => f === '*')) {
            throw new Error('fields 不支持 * 星号，请使用空数组 [] 或不传参数表示查询所有字段');
        }

        // 检测是否有空字符串或无效值
        if (fields.some((f) => !f || typeof f !== 'string' || f.trim() === '')) {
            throw new Error('fields 不能包含空字符串或无效值');
        }

        // 统计包含字段和排除字段
        const includeFields = fields.filter((f) => !f.startsWith('!'));
        const excludeFields = fields.filter((f) => f.startsWith('!'));

        // 情况2：全部是包含字段
        if (includeFields.length > 0 && excludeFields.length === 0) {
            return { type: 'include', fields: includeFields };
        }

        // 情况3：全部是排除字段
        if (excludeFields.length > 0 && includeFields.length === 0) {
            // 去掉感叹号前缀
            const cleanExcludeFields = excludeFields.map((f) => f.substring(1));
            return { type: 'exclude', fields: cleanExcludeFields };
        }

        // 混用情况：报错
        throw new Error('fields 不能同时包含普通字段和排除字段（! 开头）。只能使用以下3种方式之一：\n1. 空数组 [] 或不传（查询所有）\n2. 全部指定字段 ["id", "name"]\n3. 全部排除字段 ["!password", "!token"]');
    }

    /**
     * 获取表的所有字段名（Redis 缓存）
     * @param table - 表名（下划线格式）
     * @returns 字段名数组（下划线格式）
     */
    private async getTableColumns(table: string): Promise<string[]> {
        // 1. 先查 Redis 缓存
        const cacheKey = RedisKeys.tableColumns(table);
        let columns = await this.befly.redis.getObject<string[]>(cacheKey);

        if (columns && columns.length > 0) {
            return columns;
        }

        // 2. 缓存未命中，查询数据库
        const sql = `SHOW COLUMNS FROM \`${table}\``;
        const result = await this.executeWithConn(sql);

        if (!result || result.length === 0) {
            throw new Error(`表 ${table} 不存在或没有字段`);
        }

        columns = result.map((row: any) => row.Field);

        // 3. 写入 Redis 缓存
        await this.befly.redis.setObject(cacheKey, columns, RedisTTL.tableColumns);

        return columns;
    }

    /**
     * 字段数组转下划线格式（私有方法）
     * 支持排除字段语法
     */
    private async fieldsToSnake(table: string, fields: string[]): Promise<string[]> {
        if (!fields || !Array.isArray(fields)) return ['*'];

        // 验证并分类字段
        const { type, fields: classifiedFields } = this.validateAndClassifyFields(fields);

        // 情况1：查询所有字段
        if (type === 'all') {
            return ['*'];
        }

        // 情况2：指定包含字段
        if (type === 'include') {
            return classifiedFields.map((field) => {
                // 保留函数和特殊字段
                if (field.includes('(') || field.includes(' ')) {
                    return field;
                }
                return snakeCase(field);
            });
        }

        // 情况3：排除字段
        if (type === 'exclude') {
            // 获取表的所有字段
            const allColumns = await this.getTableColumns(table);

            // 转换排除字段为下划线格式
            const excludeSnakeFields = classifiedFields.map((f) => snakeCase(f));

            // 过滤掉排除字段
            const resultFields = allColumns.filter((col) => !excludeSnakeFields.includes(col));

            if (resultFields.length === 0) {
                throw new Error(`排除字段后没有剩余字段可查询。表: ${table}, 排除: ${excludeSnakeFields.join(', ')}`);
            }

            return resultFields;
        }

        return ['*'];
    }

    /**
     * orderBy 数组转下划线格式（私有方法）
     */
    private orderByToSnake(orderBy: string[]): string[] {
        if (!orderBy || !Array.isArray(orderBy)) return orderBy;
        return orderBy.map((item) => {
            if (typeof item !== 'string' || !item.includes('#')) return item;
            const [field, direction] = item.split('#');
            return `${snakeCase(field.trim())}#${direction.trim()}`;
        });
    }

    /**
     * 统一的查询参数预处理方法
     */
    private async prepareQueryOptions(options: QueryOptions) {
        const cleanWhere = this.cleanFields(options.where);

        // 处理 fields（支持排除语法）
        const processedFields = await this.fieldsToSnake(snakeCase(options.table), options.fields || []);

        return {
            table: snakeCase(options.table),
            fields: processedFields,
            where: this.whereKeysToSnake(cleanWhere),
            orderBy: this.orderByToSnake(options.orderBy || []),
            page: options.page || 1,
            limit: options.limit || 10
        };
    }

    /**
     * 添加默认的 state 过滤条件
     * 默认查询 state > 0 的数据（排除已删除和特殊状态）
     */
    private addDefaultStateFilter(where: WhereConditions = {}): WhereConditions {
        // 如果用户已经指定了 state 条件，优先使用用户的条件
        const hasStateCondition = Object.keys(where).some((key) => key.startsWith('state'));

        if (hasStateCondition) {
            return where;
        }

        // 默认查询 state > 0 的数据
        return {
            ...where,
            state$gt: 0
        };
    }

    /**
     * 清理数据或 where 条件（默认排除 null 和 undefined）
     */
    public cleanFields<T extends Record<string, any>>(data: T, excludeValues: any[] = [null, undefined], keepValues: Record<string, any> = {}): Partial<T> {
        return fieldClear(data || ({} as T), { excludeValues, keepMap: keepValues });
    }

    /**
     * 转换数据库 BIGINT 字段为数字类型（私有方法）
     * 当 bigint: false 时，Bun SQL 会将大于 u32 的 BIGINT 返回为字符串，此方法将其转换为 number
     *
     * 转换规则：
     * 1. 白名单中的字段会被转换
     * 2. 所有以 'Id' 或 '_id' 结尾的字段会被自动转换
     * 3. 所有以 'At' 或 '_at' 结尾的字段会被自动转换（时间戳字段）
     * 4. 其他字段保持不变
     */
    private convertBigIntFields<T = any>(arr: Record<string, any>[], fields: string[] = ['id', 'pid', 'sort']): T[] {
        if (!arr || !Array.isArray(arr)) return arr as T[];

        return arr.map((item) => {
            const converted = { ...item };

            // 遍历对象的所有字段
            for (const [key, value] of Object.entries(converted)) {
                // 跳过 undefined 和 null
                if (value === undefined || value === null) {
                    continue;
                }

                // 判断是否需要转换：
                // 1. 在白名单中
                // 2. 以 'Id' 结尾（如 userId, roleId, categoryId）
                // 3. 以 '_id' 结尾（如 user_id, role_id）
                // 4. 以 'At' 结尾（如 createdAt, updatedAt）
                // 5. 以 '_at' 结尾（如 created_at, updated_at）
                const shouldConvert = fields.includes(key) || key.endsWith('Id') || key.endsWith('_id') || key.endsWith('At') || key.endsWith('_at');

                if (shouldConvert && typeof value === 'string') {
                    const num = Number(value);
                    if (!isNaN(num)) {
                        converted[key] = num;
                    }
                }
                // number 类型保持不变（小于 u32 的值）
            }

            return converted as T;
        }) as T[];
    }

    /**
     * Where 条件键名转下划线格式（递归处理嵌套）（私有方法）
     * 支持操作符字段（如 userId$gt）和逻辑操作符（$or, $and）
     */
    private whereKeysToSnake(where: any): any {
        if (!where || typeof where !== 'object') return where;

        // 处理数组（$or, $and 等）
        if (Array.isArray(where)) {
            return where.map((item) => this.whereKeysToSnake(item));
        }

        const result: any = {};
        for (const [key, value] of Object.entries(where)) {
            // 保留 $or, $and 等逻辑操作符
            if (key === '$or' || key === '$and') {
                result[key] = (value as any[]).map((item) => this.whereKeysToSnake(item));
                continue;
            }

            // 处理带操作符的字段名（如 userId$gt）
            if (key.includes('$')) {
                const lastDollarIndex = key.lastIndexOf('$');
                const fieldName = key.substring(0, lastDollarIndex);
                const operator = key.substring(lastDollarIndex);
                const snakeKey = snakeCase(fieldName) + operator;
                result[snakeKey] = value;
                continue;
            }

            // 普通字段：转换键名，递归处理值（支持嵌套对象）
            const snakeKey = snakeCase(key);
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                result[snakeKey] = this.whereKeysToSnake(value);
            } else {
                result[snakeKey] = value;
            }
        }

        return result;
    }

    /**
     * 执行 SQL（使用 sql.unsafe，带慢查询日志和错误处理）
     */
    private async executeWithConn(sqlStr: string, params?: any[]): Promise<any> {
        if (!this.sql) {
            throw new Error('数据库连接未初始化');
        }

        // 强制类型检查：只接受字符串类型的 SQL
        if (typeof sqlStr !== 'string') {
            throw new Error(`executeWithConn 只接受字符串类型的 SQL，收到类型: ${typeof sqlStr}，值: ${JSON.stringify(sqlStr)}`);
        }

        // 记录开始时间
        const startTime = Date.now();

        try {
            // 使用 sql.unsafe 执行查询
            let result;
            if (params && params.length > 0) {
                result = await this.sql.unsafe(sqlStr, params);
            } else {
                result = await this.sql.unsafe(sqlStr);
            }

            // 计算执行时间
            const duration = Date.now() - startTime;

            // 慢查询警告（超过 1000ms）
            if (duration > 1000) {
                const sqlPreview = sqlStr.length > 100 ? sqlStr.substring(0, 100) + '...' : sqlStr;
                Logger.warn(`🐌 检测到慢查询 (${duration}ms): ${sqlPreview}`);
            }

            return result;
        } catch (error: any) {
            const duration = Date.now() - startTime;

            Logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            Logger.error('SQL 执行错误');
            Logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            Logger.error(`SQL 语句: ${sqlStr.length > 200 ? sqlStr.substring(0, 200) + '...' : sqlStr}`);
            Logger.error(`参数列表: ${JSON.stringify(params || [])}`);
            Logger.error(`执行耗时: ${duration}ms`);
            Logger.error(`错误信息: ${error.message}`);
            if (error.stack) {
                Logger.error(`错误堆栈:\n${error.stack}`);
            }
            Logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            const enhancedError: any = new Error(`SQL执行失败: ${error.message}`);
            enhancedError.originalError = error;
            enhancedError.sql = sqlStr;
            enhancedError.params = params || [];
            enhancedError.duration = duration;
            throw enhancedError;
        }
    }

    /**
     * 检查表是否存在
     * @param tableName - 表名（支持小驼峰，会自动转换为下划线）
     * @returns 表是否存在
     */
    async tableExists(tableName: string): Promise<boolean> {
        // 将表名转换为下划线格式
        const snakeTableName = snakeCase(tableName);

        const result = await this.executeWithConn('SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [snakeTableName]);

        return result?.[0]?.count > 0;
    }

    /**
     * 查询记录数
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     * @param options.where - 查询条件
     * @example
     * // 查询总数
     * const count = await db.getCount({ table: 'user' });
     * // 查询指定条件的记录数
     * const activeCount = await db.getCount({ table: 'user', where: { state: 1 } });
     */
    async getCount(options: Omit<QueryOptions, 'fields' | 'page' | 'limit' | 'orderBy'>): Promise<number> {
        const { table, where } = await this.prepareQueryOptions(options as QueryOptions);

        const builder = new SqlBuilder().select(['COUNT(*) as count']).from(table).where(this.addDefaultStateFilter(where));

        const { sql, params } = builder.toSelectSql();
        const result = await this.executeWithConn(sql, params);

        return result?.[0]?.count || 0;
    }

    /**
     * 查询单条数据
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     * @param options.fields - 字段列表（支持小驼峰或下划线格式，会自动转换为数据库字段名）
     * @example
     * // 以下两种写法等效：
     * getOne({ table: 'userProfile', fields: ['userId', 'userName'] })
     * getOne({ table: 'user_profile', fields: ['user_id', 'user_name'] })
     */
    async getOne<T = any>(options: QueryOptions): Promise<T | null> {
        const { table, fields, where } = await this.prepareQueryOptions(options);

        const builder = new SqlBuilder().select(fields).from(table).where(this.addDefaultStateFilter(where));

        const { sql, params } = builder.toSelectSql();
        const result = await this.executeWithConn(sql, params);

        // 字段名转换：下划线 → 小驼峰
        const row = result?.[0] || null;
        if (!row) return null;

        const camelRow = keysToCamel<T>(row);

        // 转换 BIGINT 字段（id, pid 等）为数字类型
        return this.convertBigIntFields<T>([camelRow])[0];
    }

    /**
     * 查询列表（带分页）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     * @param options.fields - 字段列表（支持小驼峰或下划线格式，会自动转换为数据库字段名）
     * @example
     * // 使用小驼峰格式（推荐）
     * getList({ table: 'userProfile', fields: ['userId', 'userName', 'createdAt'] })
     */
    async getList<T = any>(options: QueryOptions): Promise<ListResult<T>> {
        const prepared = await this.prepareQueryOptions(options);

        // 参数上限校验
        if (prepared.page < 1 || prepared.page > 10000) {
            throw new Error(`页码必须在 1 到 10000 之间 (table: ${options.table}, page: ${prepared.page}, limit: ${prepared.limit})`);
        }
        if (prepared.limit < 1 || prepared.limit > 1000) {
            throw new Error(`每页数量必须在 1 到 1000 之间 (table: ${options.table}, page: ${prepared.page}, limit: ${prepared.limit})`);
        }

        // 构建查询
        const whereFiltered = this.addDefaultStateFilter(prepared.where);

        // 查询总数
        const countBuilder = new SqlBuilder().select(['COUNT(*) as total']).from(prepared.table).where(whereFiltered);

        const { sql: countSql, params: countParams } = countBuilder.toSelectSql();
        const countResult = await this.executeWithConn(countSql, countParams);
        const total = countResult?.[0]?.total || 0;

        // 如果总数为 0，直接返回，不执行第二次查询
        if (total === 0) {
            return {
                lists: [],
                total: 0,
                page: prepared.page,
                limit: prepared.limit,
                pages: 0
            };
        }

        // 查询数据
        const offset = (prepared.page - 1) * prepared.limit;
        const dataBuilder = new SqlBuilder().select(prepared.fields).from(prepared.table).where(whereFiltered).limit(prepared.limit).offset(offset);

        // 只有用户明确指定了 orderBy 才添加排序
        if (prepared.orderBy && prepared.orderBy.length > 0) {
            dataBuilder.orderBy(prepared.orderBy);
        }

        const { sql: dataSql, params: dataParams } = dataBuilder.toSelectSql();
        const list = (await this.executeWithConn(dataSql, dataParams)) || [];

        // 字段名转换：下划线 → 小驼峰
        const camelList = arrayKeysToCamel<T>(list);

        // 转换 BIGINT 字段（id, pid 等）为数字类型
        return {
            lists: this.convertBigIntFields<T>(camelList),
            total: total,
            page: prepared.page,
            limit: prepared.limit,
            pages: Math.ceil(total / prepared.limit)
        };
    }

    /**
     * 查询所有数据（不分页，有上限保护）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     * @param options.fields - 字段列表（支持小驼峰或下划线格式，会自动转换为数据库字段名）
     * ⚠️ 警告：此方法会查询大量数据，建议使用 getList 分页查询
     * @example
     * // 使用小驼峰格式（推荐）
     * getAll({ table: 'userProfile', fields: ['userId', 'userName'] })
     */
    async getAll<T = any>(options: Omit<QueryOptions, 'page' | 'limit'>): Promise<T[]> {
        // 添加硬性上限保护，防止内存溢出
        const MAX_LIMIT = 10000;
        const WARNING_LIMIT = 1000;

        const prepared = await this.prepareQueryOptions({ ...options, page: 1, limit: 10 });

        const builder = new SqlBuilder().select(prepared.fields).from(prepared.table).where(this.addDefaultStateFilter(prepared.where)).limit(MAX_LIMIT);

        if (prepared.orderBy && prepared.orderBy.length > 0) {
            builder.orderBy(prepared.orderBy);
        }

        const { sql, params } = builder.toSelectSql();
        const result = (await this.executeWithConn(sql, params)) || [];

        // 警告日志：返回数据超过警告阈值
        if (result.length >= WARNING_LIMIT) {
            Logger.warn({ table: options.table, count: result.length }, 'getAll 返回数据过多，建议使用 getList 分页查询');
        }

        // 如果达到上限，额外警告
        if (result.length >= MAX_LIMIT) {
            Logger.warn({ table: options.table, limit: MAX_LIMIT }, 'getAll 达到最大限制，可能还有更多数据');
        }

        // 字段名转换：下划线 → 小驼峰
        const camelResult = arrayKeysToCamel<T>(result);

        // 转换 BIGINT 字段（id, pid 等）为数字类型
        return this.convertBigIntFields<T>(camelResult);
    }

    /**
     * 插入数据（自动生成 ID、时间戳、state）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async insData(options: InsertOptions): Promise<number> {
        const { table, data } = options;

        // 清理数据（排除 null 和 undefined）
        const cleanData = this.cleanFields(data);

        // 转换表名：小驼峰 → 下划线
        const snakeTable = snakeCase(table);

        // 处理数据（自动添加必要字段）
        // 字段名转换：小驼峰 → 下划线
        const snakeData = keysToSnake(cleanData);

        // 复制用户数据，但移除系统字段（防止用户尝试覆盖）
        const { id, created_at, updated_at, deleted_at, state, ...userData } = snakeData;

        const processed: Record<string, any> = { ...userData };

        // 强制生成 ID（不可被用户覆盖）
        try {
            processed.id = await this.befly.redis.genTimeID();
        } catch (error: any) {
            throw new Error(`生成 ID 失败，Redis 可能不可用 (table: ${table})`, error);
        }

        // 强制生成时间戳（不可被用户覆盖）
        const now = Date.now();
        processed.created_at = now;
        processed.updated_at = now;

        // 强制设置 state 为 1（激活状态，不可被用户覆盖）
        processed.state = 1;

        // 注意：deleted_at 字段不在插入时生成，只在软删除时设置

        // 构建 SQL
        const builder = new SqlBuilder();
        const { sql, params } = builder.toInsertSql(snakeTable, processed);

        // 执行
        const result = await this.executeWithConn(sql, params);
        return processed.id || result?.lastInsertRowid || 0;
    }

    /**
     * 批量插入数据（真正的批量操作）
     * 使用 INSERT INTO ... VALUES (...), (...), (...) 语法
     * 自动生成系统字段并包装在事务中
     * @param table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async insBatch(table: string, dataList: Record<string, any>[]): Promise<number[]> {
        // 空数组直接返回
        if (dataList.length === 0) {
            return [];
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
            ids.push(await this.befly.redis.genTimeID());
        }
        const now = Date.now();

        // 处理所有数据（自动添加系统字段）
        const processedList = dataList.map((data, index) => {
            // 清理数据（排除 null 和 undefined）
            const cleanData = this.cleanFields(data);

            // 字段名转换：小驼峰 → 下划线
            const snakeData = keysToSnake(cleanData);

            // 移除系统字段（防止用户尝试覆盖）
            const { id, created_at, updated_at, deleted_at, state, ...userData } = snakeData;

            // 强制生成系统字段（不可被用户覆盖）
            return {
                ...userData,
                id: ids[index],
                created_at: now,
                updated_at: now,
                state: 1
            };
        });

        // 构建批量插入 SQL
        const builder = new SqlBuilder();
        const { sql, params } = builder.toInsertSql(snakeTable, processedList);

        // 在事务中执行批量插入
        try {
            await this.executeWithConn(sql, params);
            return ids;
        } catch (error: any) {
            Logger.error({ err: error, table: table }, '批量插入失败');
            throw error;
        }
    }

    /**
     * 更新数据（强制更新时间戳，系统字段不可修改）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async updData(options: UpdateOptions): Promise<number> {
        const { table, data, where } = options;

        // 清理数据和条件（排除 null 和 undefined）
        const cleanData = this.cleanFields(data);
        const cleanWhere = this.cleanFields(where);

        // 转换表名：小驼峰 → 下划线
        const snakeTable = snakeCase(table);

        // 字段名转换：小驼峰 → 下划线
        const snakeData = keysToSnake(cleanData);
        const snakeWhere = this.whereKeysToSnake(cleanWhere);

        // 移除系统字段（防止用户尝试修改）
        // 注意：state 允许用户修改（用于设置禁用状态 state=2）
        const { id, created_at, updated_at, deleted_at, ...userData } = snakeData;

        // 强制更新时间戳（不可被用户覆盖）
        const processed: Record<string, any> = {
            ...userData,
            updated_at: Date.now()
        };

        // 构建 SQL
        const whereFiltered = this.addDefaultStateFilter(snakeWhere);
        const builder = new SqlBuilder().where(whereFiltered);
        const { sql, params } = builder.toUpdateSql(snakeTable, processed);

        // 执行
        const result = await this.executeWithConn(sql, params);
        return result?.changes || 0;
    }

    /**
     * 软删除数据（deleted_at 设置为当前时间，state 设置为 0）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async delData(options: DeleteOptions): Promise<number> {
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
    async delForce(options: Omit<DeleteOptions, 'hard'>): Promise<number> {
        const { table, where } = options;

        // 转换表名：小驼峰 → 下划线
        const snakeTable = snakeCase(table);

        // 清理条件字段
        const cleanWhere = this.cleanFields(where);
        const snakeWhere = this.whereKeysToSnake(cleanWhere);

        // 物理删除
        const builder = new SqlBuilder().where(snakeWhere);
        const { sql, params } = builder.toDeleteSql(snakeTable);

        const result = await this.executeWithConn(sql, params);
        return result?.changes || 0;
    }

    /**
     * 禁用数据（设置 state=2）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async disableData(options: Omit<DeleteOptions, 'hard'>): Promise<number> {
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
    async enableData(options: Omit<DeleteOptions, 'hard'>): Promise<number> {
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
     */
    async trans<T = any>(callback: TransactionCallback<T>): Promise<T> {
        if (this.isTransaction) {
            // 已经在事务中，直接执行回调
            return await callback(this);
        }

        // 开启新事务
        const conn = await this.befly.db.transaction();
        let committed = false;

        try {
            const trans = new DbHelper(this.befly, conn);
            const result = await callback(trans);

            // 提交事务
            try {
                await conn.query('COMMIT');
                committed = true;
            } catch (commitError: any) {
                Logger.error({ err: commitError }, '事务提交失败，正在回滚');
                await conn.query('ROLLBACK');
                throw new Error(`事务提交失败: ${commitError.message}`);
            }

            return result;
        } catch (error: any) {
            // 回调执行失败，回滚事务
            if (!committed) {
                try {
                    await conn.query('ROLLBACK');
                    Logger.warn('事务已回滚');
                } catch (rollbackError: any) {
                    Logger.error({ err: rollbackError }, '事务回滚失败');
                }
            }
            throw error;
        }
    }

    /**
     * 执行原始 SQL
     */
    async query(sql: string, params?: any[]): Promise<any> {
        return await this.executeWithConn(sql, params);
    }

    /**
     * 检查数据是否存在（优化性能）
     * @param options.table - 表名（支持小驼峰或下划线格式，会自动转换）
     */
    async exists(options: Omit<QueryOptions, 'fields' | 'orderBy' | 'page' | 'limit'>): Promise<boolean> {
        const { table, where } = await this.prepareQueryOptions({ ...options, page: 1, limit: 1 });

        // 使用 COUNT(1) 性能更好
        const builder = new SqlBuilder().select(['COUNT(1) as cnt']).from(table).where(this.addDefaultStateFilter(where)).limit(1);

        const { sql, params } = builder.toSelectSql();
        const result = await this.executeWithConn(sql, params);

        return (result?.[0]?.cnt || 0) > 0;
    }

    /**
     * 查询单个字段值（带字段名验证）
     * @param field - 字段名（支持小驼峰或下划线格式）
     */
    async getFieldValue<T = any>(options: Omit<QueryOptions, 'fields'> & { field: string }): Promise<T | null> {
        const { field, ...queryOptions } = options;

        // 验证字段名格式（只允许字母、数字、下划线）
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
            throw new Error(`无效的字段名: ${field}，只允许字母、数字和下划线`);
        }

        const result = await this.getOne({
            ...queryOptions,
            fields: [field]
        });

        if (!result) {
            return null;
        }

        // 尝试直接访问字段（小驼峰）
        if (field in result) {
            return result[field];
        }

        // 转换为小驼峰格式再尝试访问（支持用户传入下划线格式）
        const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (camelField !== field && camelField in result) {
            return result[camelField];
        }

        // 转换为下划线格式再尝试访问（支持用户传入小驼峰格式）
        const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        if (snakeField !== field && snakeField in result) {
            return result[snakeField];
        }

        return null;
    }

    /**
     * 自增字段（安全实现，防止 SQL 注入）
     * @param table - 表名（支持小驼峰或下划线格式，会自动转换）
     * @param field - 字段名（支持小驼峰或下划线格式，会自动转换）
     */
    async increment(table: string, field: string, where: WhereConditions, value: number = 1): Promise<number> {
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
        if (typeof value !== 'number' || isNaN(value)) {
            throw new Error(`自增值必须是有效的数字 (table: ${table}, field: ${field}, value: ${value})`);
        }

        // 清理 where 条件（排除 null 和 undefined）
        const cleanWhere = this.cleanFields(where);

        // 转换 where 条件字段名：小驼峰 → 下划线
        const snakeWhere = this.whereKeysToSnake(cleanWhere);

        // 使用 SqlBuilder 构建安全的 WHERE 条件
        const whereFiltered = this.addDefaultStateFilter(snakeWhere);
        const builder = new SqlBuilder().where(whereFiltered);
        const { sql: whereClause, params: whereParams } = builder.getWhereConditions();

        // 构建安全的 UPDATE SQL（表名和字段名使用反引号转义，已经是下划线格式）
        const sql = whereClause ? `UPDATE \`${snakeTable}\` SET \`${snakeField}\` = \`${snakeField}\` + ? WHERE ${whereClause}` : `UPDATE \`${snakeTable}\` SET \`${snakeField}\` = \`${snakeField}\` + ?`;

        const result = await this.executeWithConn(sql, [value, ...whereParams]);
        return result?.changes || 0;
    }

    /**
     * 自减字段
     * @param table - 表名（支持小驼峰或下划线格式，会自动转换）
     * @param field - 字段名（支持小驼峰或下划线格式，会自动转换）
     */
    async decrement(table: string, field: string, where: WhereConditions, value: number = 1): Promise<number> {
        return await this.increment(table, field, where, -value);
    }
}
