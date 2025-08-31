import { Env } from '../config/env.js';
import { Logger } from './logger.js';
import { createQueryBuilder } from './sqlBuilder.js';

// 数据库管理器（从 plugins/db.js 提取）
export class SqlManager {
    // 私有属性
    #sql;
    #befly;

    constructor(client, befly) {
        this.#sql = client;
        this.#befly = befly;
    }

    // 原始连接池访问（兼容占位）
    get pool() {
        return {
            activeConnections: () => 0,
            totalConnections: () => 0,
            idleConnections: () => 0,
            taskQueueSize: () => 0
        };
    }

    // 创建查询构造器
    query() {
        return createQueryBuilder();
    }

    // 私有方法：通用数据处理函数 - 自动添加ID、时间戳和状态
    async #processDataForInsert(data) {
        const now = Date.now();
        const genId = async () => (this.#befly?.redis?.genTimeID ? await this.#befly.redis.genTimeID() : now);

        if (Array.isArray(data)) {
            return await Promise.all(
                data.map(async (item) => ({
                    ...item,
                    id: await genId(),
                    state: 0,
                    created_at: now,
                    updated_at: now
                }))
            );
        } else {
            return {
                ...data,
                id: await genId(),
                state: 0,
                created_at: now,
                updated_at: now
            };
        }
    }

    // 私有方法：添加默认的state过滤条件
    #addDefaultStateFilter(where = {}) {
        const hasStateCondition = Object.keys(where).some((key) => key === 'state' || key.startsWith('state$'));
        if (!hasStateCondition) return { ...where, state$ne: 2 };
        return where;
    }

    // 私有方法：执行 SQL（支持传入事务连接对象）
    async #executeWithConn(query, params = [], conn = null) {
        if (!query || typeof query !== 'string') {
            throw new Error('SQL 语句是必需的');
        }

        const isSelectLike = /^\s*(with|select|show|desc|explain)\b/i.test(query);
        const isWriteLike = /^\s*(insert|update|delete|replace)\b/i.test(query);
        const client = conn || this.#sql;
        try {
            if (Env.DB_DEBUG === 1) {
                Logger.debug('执行SQL:', { sql: query, params });
            }
            // 读查询
            if (isSelectLike) {
                if (params && params.length > 0) {
                    return await client.unsafe(query, params);
                } else {
                    return await client.unsafe(query);
                }
            }

            // 写查询
            if (isWriteLike) {
                const runOn = conn ? client : await this.#sql.reserve();
                try {
                    if (params && params.length > 0) {
                        await runOn.unsafe(query, params);
                    } else {
                        await runOn.unsafe(query);
                    }
                    const [{ affectedRows }] = await runOn`SELECT ROW_COUNT() AS affectedRows`;
                    const [{ insertId }] = await runOn`SELECT LAST_INSERT_ID() AS insertId`;
                    return { affectedRows: Number(affectedRows) || 0, insertId: Number(insertId) || 0 };
                } finally {
                    if (!conn && runOn && typeof runOn.release === 'function') runOn.release();
                }
            }

            // 其他（DDL等）
            if (params && params.length > 0) {
                return await client.unsafe(query, params);
            } else {
                return await client.unsafe(query);
            }
        } catch (error) {
            Logger.error('SQL 执行失败:', { sql: query, params, error: error.message });
            throw error;
        }
    }

    // 私有方法：获取单条记录详情（支持传入连接对象）
    async #getDetailWithConn(table, options = {}, conn = null) {
        if (!table || typeof table !== 'string') {
            throw new Error('表名是必需的');
        }

        const { where = {}, fields = '*', leftJoins = [] } = typeof options === 'object' && !Array.isArray(options) ? options : { where: options };

        try {
            const filteredWhere = this.#addDefaultStateFilter(where);
            const builder = createQueryBuilder().select(fields).from(table).where(filteredWhere).limit(1);

            leftJoins.forEach((join) => {
                if (typeof join === 'string') {
                    const parts = join.split(' ON ');
                    if (parts.length === 2) builder.leftJoin(parts[0].trim(), parts[1].trim());
                } else if (join && typeof join === 'object' && join.table && join.on) {
                    builder.leftJoin(join.table, join.on);
                }
            });

            const { sql: q, params } = builder.toSelectSql();
            const result = await this.#executeWithConn(q, params, conn);
            return result[0] || null;
        } catch (error) {
            Logger.error('getDetail 执行失败:', error);
            throw error;
        }
    }

    // 私有方法：获取列表（支持传入连接对象）
    async #getListWithConn(table, options = {}, conn = null) {
        if (!table || typeof table !== 'string') {
            throw new Error('表名是必需的');
        }

        const { where = {}, fields = '*', leftJoins = [], orderBy = [], groupBy = [], having = [], page = 1, pageSize = 10 } = options;

        try {
            const filteredWhere = this.#addDefaultStateFilter(where);
            const builder = createQueryBuilder().select(fields).from(table).where(filteredWhere);

            leftJoins.forEach((join) => {
                if (typeof join === 'string') {
                    const parts = join.split(' ON ');
                    if (parts.length === 2) builder.leftJoin(parts[0].trim(), parts[1].trim());
                } else if (join && typeof join === 'object' && join.table && join.on) {
                    builder.leftJoin(join.table, join.on);
                }
            });

            if (Array.isArray(groupBy) && groupBy.length > 0) builder.groupBy(groupBy);
            if (Array.isArray(having) && having.length > 0) having.forEach((h) => builder.having(h));
            if (Array.isArray(orderBy) && orderBy.length > 0) builder.orderBy(orderBy);

            const numPage = parseInt(page) || 1;
            const numPageSize = parseInt(pageSize) || 10;
            if (numPage > 0 && numPageSize > 0) {
                const offset = (numPage - 1) * numPageSize;
                builder.limit(numPageSize, offset);
            }

            const { sql: q, params } = builder.toSelectSql();
            const rows = await this.#executeWithConn(q, params, conn);

            let total = 0;
            if (numPage > 0 && numPageSize > 0) {
                const countBuilder = createQueryBuilder().from(table).where(filteredWhere);
                leftJoins.forEach((join) => {
                    if (typeof join === 'string') {
                        const parts = join.split(' ON ');
                        if (parts.length === 2) countBuilder.leftJoin(parts[0].trim(), parts[1].trim());
                    } else if (join && typeof join === 'object' && join.table && join.on) {
                        countBuilder.leftJoin(join.table, join.on);
                    }
                });

                const { sql: countSql, params: countParams } = countBuilder.toCountSql();
                const countResult = await this.#executeWithConn(countSql, countParams, conn);
                total = countResult[0]?.total || 0;
            }

            return {
                rows: Array.isArray(rows) ? rows : [],
                total,
                page: numPage,
                pageSize: numPageSize
            };
        } catch (error) {
            Logger.error('getList 执行失败:', error);
            throw error;
        }
    }

    // 私有方法：获取所有记录（支持传入连接对象）
    async #getAllWithConn(table, options = {}, conn = null) {
        if (!table || typeof table !== 'string') {
            throw new Error('表名是必需的');
        }

        const { where = {}, fields = '*', leftJoins = [], orderBy = [] } = typeof options === 'object' && !Array.isArray(options) ? options : { where: options };

        try {
            const filteredWhere = this.#addDefaultStateFilter(where);
            const builder = createQueryBuilder().select(fields).from(table).where(filteredWhere);

            leftJoins.forEach((join) => {
                if (typeof join === 'string') {
                    const parts = join.split(' ON ');
                    if (parts.length === 2) builder.leftJoin(parts[0].trim(), parts[1].trim());
                } else if (join && typeof join === 'object' && join.table && join.on) {
                    builder.leftJoin(join.table, join.on);
                }
            });

            if (Array.isArray(orderBy) && orderBy.length > 0) builder.orderBy(orderBy);

            const { sql: q, params } = builder.toSelectSql();
            const result = await this.#executeWithConn(q, params, conn);
            return Array.isArray(result) ? result : [];
        } catch (error) {
            Logger.error('getAll 执行失败:', error);
            throw error;
        }
    }

    // 私有方法：插入数据（支持传入连接对象）
    async #insDataWithConn(table, data, conn = null) {
        if (!table || typeof table !== 'string') {
            throw new Error('表名是必需的');
        }
        if (!data) {
            throw new Error('插入数据是必需的');
        }
        try {
            const processedData = await this.#processDataForInsert(data);
            const builder = createQueryBuilder();
            const { sql: q, params } = builder.toInsertSql(table, processedData);
            return await this.#executeWithConn(q, params, conn);
        } catch (error) {
            Logger.error('insData 执行失败:', error);
            throw error;
        }
    }

    // 私有方法：更新数据（支持传入连接对象）
    async #updDataWithConn(table, data, where, conn = null) {
        if (!table || typeof table !== 'string') {
            throw new Error('表名是必需的');
        }
        if (!data || typeof data !== 'object') {
            throw new Error('更新数据是必需的');
        }
        if (!where) {
            throw new Error('更新操作需要 WHERE 条件');
        }
        try {
            const filteredData = Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== undefined && !['id', 'created_at', 'deleted_at'].includes(key)));
            const updateData = { ...filteredData, updated_at: Date.now() };
            const builder = createQueryBuilder().where(where);
            const { sql: q, params } = builder.toUpdateSql(table, updateData);
            return await this.#executeWithConn(q, params, conn);
        } catch (error) {
            Logger.error('updData 执行失败:', error);
            throw error;
        }
    }

    // 私有方法：删除数据（支持传入连接对象）
    async #delDataWithConn(table, where, conn = null) {
        if (!table || typeof table !== 'string') {
            throw new Error('表名是必需的');
        }
        if (!where) {
            throw new Error('删除操作需要 WHERE 条件');
        }
        try {
            const builder = createQueryBuilder().where(where);
            const { sql: q, params } = builder.toDeleteSql(table);
            return await this.#executeWithConn(q, params, conn);
        } catch (error) {
            Logger.error('delData 执行失败:', error);
            throw error;
        }
    }

    // 私有方法：软删除数据（支持传入连接对象）
    async #delData2WithConn(table, where, conn = null) {
        if (!table || typeof table !== 'string') {
            throw new Error('表名是必需的');
        }
        if (!where) {
            throw new Error('软删除操作需要 WHERE 条件');
        }
        try {
            const updateData = { state: 2, updated_at: Date.now() };
            const builder = createQueryBuilder().where(where);
            const { sql: q, params } = builder.toUpdateSql(table, updateData);
            return await this.#executeWithConn(q, params, conn);
        } catch (error) {
            Logger.error('delData2 执行失败:', error);
            throw error;
        }
    }

    // 私有方法：批量插入（支持传入连接对象）
    async #insBatchWithConn(table, dataArray, conn = null) {
        if (!table || typeof table !== 'string') {
            throw new Error('表名是必需的');
        }
        if (!Array.isArray(dataArray) || dataArray.length === 0) {
            throw new Error('批量插入数据不能为空');
        }
        try {
            const processedDataArray = await this.#processDataForInsert(dataArray);
            const builder = createQueryBuilder();
            const { sql: q, params } = builder.toInsertSql(table, processedDataArray);
            return await this.#executeWithConn(q, params, conn);
        } catch (error) {
            Logger.error('insBatch 执行失败:', error);
            throw error;
        }
    }

    // 私有方法：获取记录总数（支持传入连接对象）
    async #getCountWithConn(table, options = {}, conn = null) {
        if (!table || typeof table !== 'string') {
            throw new Error('表名是必需的');
        }
        const { where = {}, leftJoins = [] } = typeof options === 'object' && !Array.isArray(options) ? options : { where: options };
        try {
            const filteredWhere = this.#addDefaultStateFilter(where);
            const builder = createQueryBuilder().from(table).where(filteredWhere);

            leftJoins.forEach((join) => {
                if (typeof join === 'string') {
                    const parts = join.split(' ON ');
                    if (parts.length === 2) builder.leftJoin(parts[0].trim(), parts[1].trim());
                } else if (join && typeof join === 'object' && join.table && join.on) {
                    builder.leftJoin(join.table, join.on);
                }
            });

            const { sql: q, params } = builder.toCountSql();
            const result = await this.#executeWithConn(q, params, conn);
            return result[0]?.total || 0;
        } catch (error) {
            Logger.error('getCount 执行失败:', error);
            throw error;
        }
    }

    // 执行原始 SQL - 核心方法
    async execute(sql, params = []) {
        return await this.#executeWithConn(sql, params);
    }

    // 获取单条记录详情
    async getDetail(table, options = {}) {
        return await this.#getDetailWithConn(table, options);
    }

    // 获取列表（支持分页）
    async getList(table, options = {}) {
        return await this.#getListWithConn(table, options);
    }

    // 获取所有记录
    async getAll(table, options = {}) {
        return await this.#getAllWithConn(table, options);
    }

    // 插入数据 - 增强版
    async insData(table, data) {
        return await this.#insDataWithConn(table, data);
    }

    // 更新数据 - 增强版
    async updData(table, data, where) {
        return await this.#updDataWithConn(table, data, where);
    }

    // 删除数据
    async delData(table, where) {
        return await this.#delDataWithConn(table, where);
    }

    // 软删除数据
    async delData2(table, where) {
        return await this.#delData2WithConn(table, where);
    }

    // 批量插入 - 增强版
    async insBatch(table, dataArray) {
        return await this.#insBatchWithConn(table, dataArray);
    }

    // 获取记录总数
    async getCount(table, options = {}) {
        return await this.#getCountWithConn(table, options);
    }

    // 事务处理
    async trans(callback) {
        if (typeof callback !== 'function') {
            throw new Error('事务回调函数是必需的');
        }
        try {
            const result = await this.#sql.begin(async (tx) => {
                const txMethods = {
                    query: async (query, params = []) => this.#executeWithConn(query, params, tx),
                    execute: async (query, params = []) => this.#executeWithConn(query, params, tx),

                    getDetail: async (table, options = {}) => this.#getDetailWithConn(table, options, tx),
                    getList: async (table, options = {}) => this.#getListWithConn(table, options, tx),
                    getAll: async (table, options = {}) => this.#getAllWithConn(table, options, tx),
                    insData: async (table, data) => this.#insDataWithConn(table, data, tx),
                    updData: async (table, data, where) => this.#updDataWithConn(table, data, where, tx),
                    delData: async (table, where) => this.#delDataWithConn(table, where, tx),
                    delData2: async (table, where) => this.#delData2WithConn(table, where, tx),
                    getCount: async (table, options = {}) => this.#getCountWithConn(table, options, tx),
                    insBatch: async (table, dataArray) => this.#insBatchWithConn(table, dataArray, tx)
                };
                return await callback(txMethods);
            });
            return result;
        } catch (error) {
            Logger.info('事务已回滚');
            throw error;
        }
    }

    // 获取连接池状态
    getPoolStatus() {
        return {
            activeConnections: 0,
            totalConnections: 0,
            idleConnections: 0,
            taskQueueSize: 0
        };
    }

    // 关闭连接池
    async close() {
        if (this.#sql) {
            try {
                await this.#sql.close();
                Logger.info('数据库连接已关闭');
            } catch (error) {
                Logger.error('关闭数据库连接失败:', error);
                throw error;
            }
        }
    }
}

export default SqlManager;
