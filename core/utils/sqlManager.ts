/**
 * SQL 管理器 - TypeScript 版本
 * 提供数据库 CRUD 操作的封装
 */

import { SqlBuilder } from './sqlBuilder.js';
import type { WhereConditions } from '../types/common.js';
import type { BeflyContext } from '../types/befly.js';
import type { QueryOptions, InsertOptions, UpdateOptions, DeleteOptions, ListResult, TransactionCallback, DatabaseConnection } from '../types/database';

/**
 * SQL 管理器类
 */
export class SqlManager {
    private befly: BeflyContext;
    private connection: DatabaseConnection | null = null;
    private isTransaction: boolean = false;

    /**
     * 构造函数
     * @param befly - Befly 上下文
     * @param connection - 数据库连接（可选，用于事务）
     */
    constructor(befly: BeflyContext, connection: DatabaseConnection | null = null) {
        this.befly = befly;
        this.connection = connection;
        this.isTransaction = !!connection;
    }

    /**
     * 处理插入数据（添加 ID、时间戳、state）
     */
    private async processDataForInsert(data: Record<string, any>, options: { autoId?: boolean; autoTimestamp?: boolean; autoState?: boolean }): Promise<Record<string, any>> {
        const processed = { ...data };

        // 添加 ID
        if (options.autoId !== false && !processed.id) {
            processed.id = await this.befly.redis.genTimeID();
        }

        // 添加时间戳
        if (options.autoTimestamp !== false) {
            const now = new Date();
            if (!processed.created_at) {
                processed.created_at = now;
            }
            if (!processed.updated_at) {
                processed.updated_at = now;
            }
        }

        // 添加 state
        if (options.autoState !== false && !processed.state) {
            processed.state = 1;
        }

        return processed;
    }

    /**
     * 添加默认 state 过滤（排除已删除数据）
     */
    private addDefaultStateFilter(where: WhereConditions | undefined, includeDeleted: boolean = false, customState?: WhereConditions): WhereConditions {
        if (includeDeleted) {
            return where || {};
        }

        // 如果有自定义 state 条件，使用自定义条件
        if (customState) {
            return where ? { ...where, ...customState } : customState;
        }

        // 默认排除已删除（state = 0）
        const stateFilter: WhereConditions = { state: { $gt: 0 } };
        return where ? { ...where, ...stateFilter } : stateFilter;
    }

    /**
     * 执行 SQL（带连接处理）
     */
    private async executeWithConn(sql: string, params?: any[]): Promise<any> {
        if (this.connection) {
            return await this.connection.query(sql, params);
        }
        return await this.befly.db.query(sql, params);
    }

    /**
     * 查询单条数据
     */
    async getDetail<T = any>(options: QueryOptions): Promise<T | null> {
        const { table, fields = ['*'], where, includeDeleted = false, customState } = options;

        const builder = new SqlBuilder().select(fields).from(table).where(this.addDefaultStateFilter(where, includeDeleted, customState)).limit(1);

        const { sql, params } = builder.toSelectSql();
        const result = await this.executeWithConn(sql, params);

        return result?.[0] || null;
    }

    /**
     * 查询列表（带分页）
     */
    async getList<T = any>(options: QueryOptions): Promise<ListResult<T>> {
        const { table, fields = ['*'], where, orderBy = 'id DESC', page = 1, limit = 10, includeDeleted = false, customState } = options;

        // 构建查询
        const whereFiltered = this.addDefaultStateFilter(where, includeDeleted, customState);

        // 查询总数
        const countBuilder = new SqlBuilder().select(['COUNT(*) as total']).from(table).where(whereFiltered);

        const { sql: countSql, params: countParams } = countBuilder.toSelectSql();
        const countResult = await this.executeWithConn(countSql, countParams);
        const total = countResult?.[0]?.total || 0;

        // 查询数据
        const offset = (page - 1) * limit;
        const dataBuilder = new SqlBuilder().select(fields).from(table).where(whereFiltered).orderBy(orderBy).limit(limit).offset(offset);

        const { sql: dataSql, params: dataParams } = dataBuilder.toSelectSql();
        const list = (await this.executeWithConn(dataSql, dataParams)) || [];

        return {
            list,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        };
    }

    /**
     * 查询所有数据（不分页）
     */
    async getAll<T = any>(options: Omit<QueryOptions, 'page' | 'limit'>): Promise<T[]> {
        const { table, fields = ['*'], where, orderBy, includeDeleted = false, customState } = options;

        const builder = new SqlBuilder().select(fields).from(table).where(this.addDefaultStateFilter(where, includeDeleted, customState));

        if (orderBy) {
            builder.orderBy(orderBy);
        }

        const { sql, params } = builder.toSelectSql();
        return (await this.executeWithConn(sql, params)) || [];
    }

    /**
     * 插入数据
     */
    async insData(options: InsertOptions): Promise<number> {
        const { table, data, autoId = true, autoTimestamp = true, autoState = true } = options;

        // 处理数据
        const processed = await this.processDataForInsert(data, {
            autoId,
            autoTimestamp,
            autoState
        });

        // 构建 SQL
        const builder = new SqlBuilder().from(table);
        const { sql, params } = builder.toInsertSql(processed);

        // 执行
        const result = await this.executeWithConn(sql, params);
        return processed.id || result?.lastInsertRowid || 0;
    }

    /**
     * 批量插入数据
     */
    async insDataBatch(table: string, dataList: Record<string, any>[]): Promise<number[]> {
        const ids: number[] = [];

        for (const data of dataList) {
            const id = await this.insData({ table, data });
            ids.push(id);
        }

        return ids;
    }

    /**
     * 更新数据
     */
    async updData(options: UpdateOptions): Promise<number> {
        const { table, data, where, autoTimestamp = true, includeDeleted = false } = options;

        // 添加更新时间
        const processed = { ...data };
        if (autoTimestamp && !processed.updated_at) {
            processed.updated_at = new Date();
        }

        // 构建 SQL
        const whereFiltered = this.addDefaultStateFilter(where, includeDeleted);
        const builder = new SqlBuilder().from(table).where(whereFiltered);
        const { sql, params } = builder.toUpdateSql(processed);

        // 执行
        const result = await this.executeWithConn(sql, params);
        return result?.changes || 0;
    }

    /**
     * 删除数据
     */
    async delData(options: DeleteOptions): Promise<number> {
        const { table, where, hard = false, autoTimestamp = true } = options;

        if (hard) {
            // 物理删除
            const builder = new SqlBuilder().from(table).where(where);
            const { sql, params } = builder.toDeleteSql();

            const result = await this.executeWithConn(sql, params);
            return result?.changes || 0;
        } else {
            // 软删除（更新 state）
            const data: Record<string, any> = { state: 0 };
            if (autoTimestamp) {
                data.updated_at = new Date();
            }

            return await this.updData({
                table,
                data,
                where,
                includeDeleted: true // 软删除时允许操作已删除数据
            });
        }
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

        try {
            const trans = new SqlManager(this.befly, conn);
            const result = await callback(trans);
            await conn.query('COMMIT');
            return result;
        } catch (error) {
            await conn.query('ROLLBACK');
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
     * 检查数据是否存在
     */
    async exists(options: Omit<QueryOptions, 'fields' | 'orderBy' | 'page' | 'limit'>): Promise<boolean> {
        const result = await this.getDetail({
            ...options,
            fields: ['1']
        });
        return !!result;
    }

    /**
     * 查询单个字段值
     */
    async getFieldValue<T = any>(options: Omit<QueryOptions, 'fields'> & { field: string }): Promise<T | null> {
        const { field, ...queryOptions } = options;
        const result = await this.getDetail({
            ...queryOptions,
            fields: [field]
        });
        return result ? result[field] : null;
    }

    /**
     * 自增字段
     */
    async increment(table: string, field: string, where: WhereConditions, value: number = 1): Promise<number> {
        const sql = `UPDATE ${table} SET ${field} = ${field} + ? WHERE ${this.buildWhereClause(where)}`;
        const result = await this.executeWithConn(sql, [value]);
        return result?.changes || 0;
    }

    /**
     * 自减字段
     */
    async decrement(table: string, field: string, where: WhereConditions, value: number = 1): Promise<number> {
        return await this.increment(table, field, where, -value);
    }

    /**
     * 构建 WHERE 子句（辅助方法）
     */
    private buildWhereClause(where: WhereConditions): string {
        const builder = new SqlBuilder().where(where);
        const { sql } = builder.toSelectSql();
        const whereIndex = sql.indexOf('WHERE');
        return whereIndex > -1 ? sql.substring(whereIndex + 6) : '1=1';
    }
}
