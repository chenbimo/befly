/**
 * 数据库助手 - TypeScript 版本
 * 提供数据库 CRUD 操作的封装
 */

import { SqlBuilder } from './sqlBuilder.js';
import { keysToCamel, arrayKeysToCamel, keysToSnake, whereKeysToSnake, fieldClear } from './helper.js';
import { Logger } from './logger.js';
import { DBError } from './errors.js';
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
    private cleanFields<T extends Record<string, any>>(data: T | undefined | null, excludeValues: any[] = [null, undefined], keepValues: Record<string, any> = {}): Partial<T> {
        return fieldClear(data || ({} as T), excludeValues, keepValues);
    }

    /**
     * 执行 SQL（使用 sql.unsafe，带慢查询日志）
     */
    private async executeWithConn(sqlStr: string, params?: any[]): Promise<any> {
        if (!this.sql) {
            throw DBError.connectionFailed('数据库连接未初始化');
        }

        // 记录开始时间
        const startTime = Date.now();

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
    }

    /**
     * 查询单条数据
     */
    async getOne<T = any>(options: QueryOptions): Promise<T | null> {
        const { table, fields = ['*'], where } = options;

        // 清理 where 条件（排除 null 和 undefined）
        const cleanWhere = this.cleanFields(where);

        // 转换 where 条件字段名：小驼峰 → 下划线
        const snakeWhere = whereKeysToSnake(cleanWhere);

        const builder = new SqlBuilder().select(fields).from(table).where(this.addDefaultStateFilter(snakeWhere)).limit(1);

        const { sql, params } = builder.toSelectSql();
        const result = await this.executeWithConn(sql, params);

        // 字段名转换：下划线 → 小驼峰
        const row = result?.[0] || null;
        return row ? keysToCamel<T>(row) : null;
    }

    /**
     * 查询列表（带分页）
     */
    async getList<T = any>(options: QueryOptions): Promise<ListResult<T>> {
        const { table, fields = ['*'], where, orderBy = [], page = 1, limit = 10 } = options;

        // P1: 添加参数上限校验
        if (page < 1 || page > 10000) {
            throw DBError.invalidParams('页码必须在 1 到 10000 之间', { table, page, limit });
        }
        if (limit < 1 || limit > 1000) {
            throw DBError.invalidParams('每页数量必须在 1 到 1000 之间', { table, page, limit });
        }

        // 清理 where 条件（排除 null 和 undefined）
        const cleanWhere = this.cleanFields(where);

        // 转换 where 条件字段名：小驼峰 → 下划线
        const snakeWhere = whereKeysToSnake(cleanWhere);

        // 构建查询
        const whereFiltered = this.addDefaultStateFilter(snakeWhere);

        // 查询总数
        const countBuilder = new SqlBuilder().select(['COUNT(*) as total']).from(table).where(whereFiltered);

        const { sql: countSql, params: countParams } = countBuilder.toSelectSql();
        const countResult = await this.executeWithConn(countSql, countParams);
        const total = countResult?.[0]?.total || 0;

        // P1: 如果总数为 0，直接返回，不执行第二次查询
        if (total === 0) {
            return {
                list: [],
                total: 0,
                page,
                limit,
                pages: 0
            };
        }

        // 查询数据
        const offset = (page - 1) * limit;
        const dataBuilder = new SqlBuilder().select(fields).from(table).where(whereFiltered).limit(limit).offset(offset);

        // P1: 只有用户明确指定了 orderBy 才添加排序
        if (orderBy && orderBy.length > 0) {
            dataBuilder.orderBy(orderBy);
        }

        const { sql: dataSql, params: dataParams } = dataBuilder.toSelectSql();
        const list = (await this.executeWithConn(dataSql, dataParams)) || [];

        // 字段名转换：下划线 → 小驼峰
        return {
            list: arrayKeysToCamel<T>(list),
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        };
    }

    /**
     * 查询所有数据（不分页，有上限保护）
     * ⚠️ 警告：此方法会查询大量数据，建议使用 getList 分页查询
     */
    async getAll<T = any>(options: Omit<QueryOptions, 'page' | 'limit'>): Promise<T[]> {
        const { table, fields = ['*'], where, orderBy } = options;

        // 添加硬性上限保护，防止内存溢出
        const MAX_LIMIT = 10000;
        const WARNING_LIMIT = 1000;

        // 清理 where 条件（排除 null 和 undefined）
        const cleanWhere = this.cleanFields(where);

        // 转换 where 条件字段名：小驼峰 → 下划线
        const snakeWhere = whereKeysToSnake(cleanWhere);

        const builder = new SqlBuilder().select(fields).from(table).where(this.addDefaultStateFilter(snakeWhere)).limit(MAX_LIMIT); // 强制添加上限

        if (orderBy) {
            builder.orderBy(orderBy);
        }

        const { sql, params } = builder.toSelectSql();
        const result = (await this.executeWithConn(sql, params)) || [];

        // 警告日志：返回数据超过警告阈值
        if (result.length >= WARNING_LIMIT) {
            Logger.warn(`⚠️ getAll 从表 \`${table}\` 返回了 ${result.length} 行数据，建议使用 getList 分页查询以获得更好的性能。`);
        }

        // 如果达到上限，额外警告
        if (result.length >= MAX_LIMIT) {
            Logger.warn(`🚨 getAll 达到了最大限制 (${MAX_LIMIT})，可能还有更多数据。请使用 getList 分页查询。`);
        }

        // 字段名转换：下划线 → 小驼峰
        return arrayKeysToCamel<T>(result);
    }

    /**
     * 插入数据（自动生成 ID、时间戳、state）
     */
    async insData(options: InsertOptions): Promise<number> {
        const { table, data } = options;

        // 清理数据（排除 null 和 undefined）
        const cleanData = this.cleanFields(data);

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
            throw DBError.idGenerationFailed('生成 ID 失败，Redis 可能不可用', { table }, error);
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
        const { sql, params } = builder.toInsertSql(table, processed);

        // 执行
        const result = await this.executeWithConn(sql, params);
        return processed.id || result?.lastInsertRowid || 0;
    }

    /**
     * 批量插入数据（真正的批量操作）
     * 使用 INSERT INTO ... VALUES (...), (...), (...) 语法
     * 自动生成系统字段并包装在事务中
     */
    async insDataBatch(table: string, dataList: Record<string, any>[]): Promise<number[]> {
        // 空数组直接返回
        if (dataList.length === 0) {
            return [];
        }

        // 限制批量大小
        const MAX_BATCH_SIZE = 1000;
        if (dataList.length > MAX_BATCH_SIZE) {
            throw DBError.batchSizeExceeded(dataList.length, MAX_BATCH_SIZE);
        }

        // 批量生成 ID（一次性从 Redis 获取 N 个 ID）
        const ids = await this.befly.redis.genTimeIDBatch(dataList.length);
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
        const { sql, params } = builder.toInsertSql(table, processedList);

        // 在事务中执行批量插入
        try {
            await this.executeWithConn(sql, params);
            return ids;
        } catch (error: any) {
            // 批量插入失败，记录错误
            Logger.error(`表 \`${table}\` 批量插入失败:`, error.message);
            throw error;
        }
    }

    /**
     * 更新数据（强制更新时间戳，系统字段不可修改）
     */
    async updData(options: UpdateOptions): Promise<number> {
        const { table, data, where } = options;

        // 清理数据和条件（排除 null 和 undefined）
        const cleanData = this.cleanFields(data);
        const cleanWhere = this.cleanFields(where);

        // 字段名转换：小驼峰 → 下划线
        const snakeData = keysToSnake(cleanData);
        const snakeWhere = whereKeysToSnake(cleanWhere);

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
        const { sql, params } = builder.toUpdateSql(table, processed);

        // 执行
        const result = await this.executeWithConn(sql, params);
        return result?.changes || 0;
    }

    /**
     * 软删除数据（设置 state=0 并记录删除时间）
     */
    async delData(options: Omit<DeleteOptions, 'hard'>): Promise<number> {
        const { table, where } = options;

        // 清理 where 条件（排除 null 和 undefined）
        const cleanWhere = this.cleanFields(where);

        // 字段名转换：小驼峰 → 下划线
        const snakeWhere = whereKeysToSnake(cleanWhere);

        // 软删除：设置 state=0 并记录删除时间
        const now = Date.now();
        const snakeData = keysToSnake({
            state: 0,
            updatedAt: now,
            deletedAt: now
        });

        // 移除系统字段
        const { id, created_at, updated_at, deleted_at, ...userData } = snakeData;

        // 强制更新时间戳
        const processed: Record<string, any> = {
            ...userData,
            updated_at: now
        };

        // 构建 SQL（软删除时也要加 state > 0 过滤，避免重复删除）
        const whereFiltered = this.addDefaultStateFilter(snakeWhere);
        const builder = new SqlBuilder().where(whereFiltered);
        const { sql, params } = builder.toUpdateSql(table, processed);

        // 执行
        const result = await this.executeWithConn(sql, params);
        return result?.changes || 0;
    }

    /**
     * 硬删除数据（物理删除，不可恢复）
     */
    async delForce(options: Omit<DeleteOptions, 'hard'>): Promise<number> {
        const { table, where } = options;

        // 物理删除
        const builder = new SqlBuilder().where(where);
        const { sql, params } = builder.toDeleteSql(table);

        const result = await this.executeWithConn(sql, params);
        return result?.changes || 0;
    }

    /**
     * 禁用数据（设置 state=2）
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
                Logger.error('事务提交失败，正在回滚:', commitError.message);
                await conn.query('ROLLBACK');
                throw DBError.transactionCommitFailed('事务提交失败', {}, commitError);
            }

            return result;
        } catch (error: any) {
            // 回调执行失败，回滚事务
            if (!committed) {
                try {
                    await conn.query('ROLLBACK');
                    Logger.warn('事务已回滚');
                } catch (rollbackError: any) {
                    Logger.error('事务回滚失败:', rollbackError.message);
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
     */
    async exists(options: Omit<QueryOptions, 'fields' | 'orderBy' | 'page' | 'limit'>): Promise<boolean> {
        const { table, where } = options;

        // 清理 where 条件（排除 null 和 undefined）
        const cleanWhere = this.cleanFields(where);

        // 使用 COUNT(1) 性能更好
        const builder = new SqlBuilder().select(['COUNT(1) as cnt']).from(table).where(this.addDefaultStateFilter(cleanWhere)).limit(1);

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
            throw DBError.invalidFieldName(`无效的字段名: ${field}，只允许字母、数字和下划线。`, { field });
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
     */
    async increment(table: string, field: string, where: WhereConditions, value: number = 1): Promise<number> {
        // 验证表名格式（只允许字母、数字、下划线）
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
            throw DBError.invalidTableName(`无效的表名: ${table}`, { table });
        }

        // 验证字段名格式（只允许字母、数字、下划线）
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
            throw DBError.invalidFieldName(`无效的字段名: ${field}`, { field });
        }

        // 验证 value 必须是数字
        if (typeof value !== 'number' || isNaN(value)) {
            throw DBError.invalidParams(`自增值必须是有效的数字`, { table, field, value });
        }

        // 清理 where 条件（排除 null 和 undefined）
        const cleanWhere = this.cleanFields(where);

        // 转换 where 条件字段名：小驼峰 → 下划线
        const snakeWhere = whereKeysToSnake(cleanWhere);

        // 使用 SqlBuilder 构建安全的 WHERE 条件
        const whereFiltered = this.addDefaultStateFilter(snakeWhere);
        const builder = new SqlBuilder().where(whereFiltered);
        const { sql: whereClause, params: whereParams } = builder.getWhereConditions();

        // 构建安全的 UPDATE SQL（表名和字段名使用反引号转义）
        const sql = whereClause ? `UPDATE \`${table}\` SET \`${field}\` = \`${field}\` + ? WHERE ${whereClause}` : `UPDATE \`${table}\` SET \`${field}\` = \`${field}\` + ?`;

        const result = await this.executeWithConn(sql, [value, ...whereParams]);
        return result?.changes || 0;
    }

    /**
     * 自减字段
     */
    async decrement(table: string, field: string, where: WhereConditions, value: number = 1): Promise<number> {
        return await this.increment(table, field, where, -value);
    }
}
