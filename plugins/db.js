import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { createQueryBuilder } from '../utils/curd.js';

export default {
    after: ['_redis'],
    async onInit(befly) {
        let pool = null;

        try {
            if (Env.MYSQL_ENABLE === 1) {
                // 动态导入 MariaDB 连接器
                const mariadb = await import('mariadb');

                // 创建 MariaDB 连接池配置
                const config = {
                    host: Env.MYSQL_HOST || '127.0.0.1',
                    port: Env.MYSQL_PORT || 3306,
                    database: Env.MYSQL_DB || 'test',
                    user: Env.MYSQL_USER || 'root',
                    password: Env.MYSQL_PASSWORD || 'root',
                    connectionLimit: Env.MYSQL_POOL_MAX || 10,
                    charset: 'utf8mb4',
                    timezone: Env.TIMEZONE || 'local',
                    debug: Env.MYSQL_DEBUG === 1,
                    acquireTimeout: 60000,
                    timeout: 60000,
                    // 连接保活设置
                    idleTimeout: 1800000, // 30分钟
                    minimumIdle: 2,
                    // 重连设置
                    reconnect: true,
                    // 避免连接超时
                    keepAliveDelay: 30000,
                    insertIdAsNumber: true,
                    decimalAsNumber: true,
                    bigIntAsNumber: true
                };

                // 创建连接池
                pool = mariadb.createPool(config);

                // 测试数据库连接
                let conn;
                try {
                    conn = await pool.getConnection();
                    const result = await conn.query('SELECT VERSION() AS version');
                    Logger.info(`数据库连接成功，MariaDB 版本: ${result[0].version}`);
                } catch (error) {
                    Logger.error('数据库连接测试失败:', error);
                    throw error;
                } finally {
                    if (conn) {
                        try {
                            conn.release();
                        } catch (releaseError) {
                            Logger.warn('连接释放警告:', releaseError.message);
                        }
                    }
                }

                // 数据库管理类
                class DatabaseManager {
                    // 私有属性
                    #pool;

                    constructor(pool) {
                        this.#pool = pool;
                    }

                    // 原始连接池访问
                    get pool() {
                        return this.#pool;
                    }

                    // 创建查询构造器
                    query() {
                        return createQueryBuilder();
                    }

                    // 私有方法：通用数据处理函数 - 自动添加ID、时间戳和状态
                    async #processDataForInsert(data) {
                        const now = Date.now();

                        if (Array.isArray(data)) {
                            return await Promise.all(
                                data.map(async (item) => ({
                                    ...item,
                                    id: await befly.redis.genTimeID(),
                                    state: 0,
                                    created_at: now,
                                    updated_at: now
                                }))
                            );
                        } else {
                            return {
                                ...data,
                                id: await befly.redis.genTimeID(),
                                state: 0,
                                created_at: now,
                                updated_at: now
                            };
                        }
                    }

                    // 私有方法：添加默认的state过滤条件
                    #addDefaultStateFilter(where = {}) {
                        // 检查是否已有state相关条件
                        const hasStateCondition = Object.keys(where).some((key) => key === 'state' || key.startsWith('state$'));

                        // 如果没有state条件，添加默认过滤
                        if (!hasStateCondition) {
                            return { ...where, state$ne: 2 };
                        }

                        return where;
                    }

                    // 私有方法：执行 SQL（支持传入连接对象）
                    async #executeWithConn(sql, params = [], conn = null) {
                        if (!sql || typeof sql !== 'string') {
                            throw new Error('SQL 语句是必需的');
                        }

                        let providedConn = conn;
                        let shouldRelease = false;

                        try {
                            // 如果没有提供连接，从池中获取
                            if (!providedConn) {
                                providedConn = await this.#pool.getConnection();
                                shouldRelease = true;
                            }

                            if (Env.MYSQL_DEBUG === 1) {
                                Logger.debug('执行SQL:', { sql, params });
                            }

                            const result = await providedConn.query(sql, params);
                            return result;
                        } catch (error) {
                            Logger.error('SQL 执行失败:', { sql, params, error: error.message });
                            throw error;
                        } finally {
                            // 只有当连接是我们获取的时候才释放
                            if (shouldRelease && providedConn) {
                                try {
                                    providedConn.release();
                                } catch (releaseError) {
                                    Logger.warn('连接释放警告:', releaseError.message);
                                }
                            }
                        }
                    }

                    // 私有方法：获取单条记录详情（支持传入连接对象）
                    async #getDetailWithConn(table, options = {}, conn = null) {
                        if (!table || typeof table !== 'string') {
                            throw new Error('表名是必需的');
                        }

                        const { where = {}, fields = '*', leftJoins = [] } = typeof options === 'object' && !Array.isArray(options) ? options : { where: options };

                        try {
                            // 添加默认的state过滤条件
                            const filteredWhere = this.#addDefaultStateFilter(where);
                            const builder = createQueryBuilder().select(fields).from(table).where(filteredWhere).limit(1);

                            // 添加 LEFT JOIN
                            leftJoins.forEach((join) => {
                                if (typeof join === 'string') {
                                    const parts = join.split(' ON ');
                                    if (parts.length === 2) {
                                        builder.leftJoin(parts[0].trim(), parts[1].trim());
                                    }
                                } else if (join && typeof join === 'object' && join.table && join.on) {
                                    builder.leftJoin(join.table, join.on);
                                }
                            });

                            const { sql, params } = builder.toSelectSql();
                            const result = await this.#executeWithConn(sql, params, conn);
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
                            // 添加默认的state过滤条件
                            const filteredWhere = this.#addDefaultStateFilter(where);
                            const builder = createQueryBuilder().select(fields).from(table).where(filteredWhere);

                            // 添加 LEFT JOIN
                            leftJoins.forEach((join) => {
                                if (typeof join === 'string') {
                                    const parts = join.split(' ON ');
                                    if (parts.length === 2) {
                                        builder.leftJoin(parts[0].trim(), parts[1].trim());
                                    }
                                } else if (join && typeof join === 'object' && join.table && join.on) {
                                    builder.leftJoin(join.table, join.on);
                                }
                            });

                            // 添加其他子句
                            if (Array.isArray(groupBy) && groupBy.length > 0) {
                                builder.groupBy(groupBy);
                            }

                            if (Array.isArray(having) && having.length > 0) {
                                having.forEach((h) => builder.having(h));
                            }

                            if (Array.isArray(orderBy) && orderBy.length > 0) {
                                builder.orderBy(orderBy);
                            }

                            // 分页处理
                            const numPage = parseInt(page) || 1;
                            const numPageSize = parseInt(pageSize) || 10;

                            if (numPage > 0 && numPageSize > 0) {
                                const offset = (numPage - 1) * numPageSize;
                                builder.limit(numPageSize, offset);
                            }

                            const { sql, params } = builder.toSelectSql();
                            const rows = await this.#executeWithConn(sql, params, conn);

                            // 获取总数（如果需要分页）
                            let total = 0;
                            if (numPage > 0 && numPageSize > 0) {
                                const countBuilder = createQueryBuilder().from(table).where(filteredWhere);

                                // 计算总数时也要包含 JOIN
                                leftJoins.forEach((join) => {
                                    if (typeof join === 'string') {
                                        const parts = join.split(' ON ');
                                        if (parts.length === 2) {
                                            countBuilder.leftJoin(parts[0].trim(), parts[1].trim());
                                        }
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
                            // 添加默认的state过滤条件
                            const filteredWhere = this.#addDefaultStateFilter(where);
                            const builder = createQueryBuilder().select(fields).from(table).where(filteredWhere);

                            // 添加 LEFT JOIN
                            leftJoins.forEach((join) => {
                                if (typeof join === 'string') {
                                    const parts = join.split(' ON ');
                                    if (parts.length === 2) {
                                        builder.leftJoin(parts[0].trim(), parts[1].trim());
                                    }
                                } else if (join && typeof join === 'object' && join.table && join.on) {
                                    builder.leftJoin(join.table, join.on);
                                }
                            });

                            if (Array.isArray(orderBy) && orderBy.length > 0) {
                                builder.orderBy(orderBy);
                            }

                            const { sql, params } = builder.toSelectSql();
                            const result = await this.#executeWithConn(sql, params, conn);
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
                            const { sql, params } = builder.toInsertSql(table, processedData);
                            return await this.#executeWithConn(sql, params, conn);
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
                            // 剔除 undefined 值和敏感字段
                            const filteredData = Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== undefined && !['id', 'created_at', 'deleted_at'].includes(key)));

                            // 自动添加 updated_at
                            const updateData = {
                                ...filteredData,
                                updated_at: Date.now()
                            };

                            const builder = createQueryBuilder().where(where);
                            const { sql, params } = builder.toUpdateSql(table, updateData);
                            return await this.#executeWithConn(sql, params, conn);
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
                            const { sql, params } = builder.toDeleteSql(table);
                            return await this.#executeWithConn(sql, params, conn);
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
                            // 软删除：将 state 设置为 2，同时更新 updated_at
                            const updateData = {
                                state: 2,
                                updated_at: Date.now()
                            };

                            const builder = createQueryBuilder().where(where);
                            const { sql, params } = builder.toUpdateSql(table, updateData);
                            return await this.#executeWithConn(sql, params, conn);
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
                            const { sql, params } = builder.toInsertSql(table, processedDataArray);
                            return await this.#executeWithConn(sql, params, conn);
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
                            // 添加默认的state过滤条件
                            const filteredWhere = this.#addDefaultStateFilter(where);
                            const builder = createQueryBuilder().from(table).where(filteredWhere);

                            // 添加 LEFT JOIN
                            leftJoins.forEach((join) => {
                                if (typeof join === 'string') {
                                    const parts = join.split(' ON ');
                                    if (parts.length === 2) {
                                        builder.leftJoin(parts[0].trim(), parts[1].trim());
                                    }
                                } else if (join && typeof join === 'object' && join.table && join.on) {
                                    builder.leftJoin(join.table, join.on);
                                }
                            });

                            const { sql, params } = builder.toCountSql();
                            const result = await this.#executeWithConn(sql, params, conn);
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

                    // 插入数据 - 增强版，自动添加 ID 和时间戳
                    async insData(table, data) {
                        return await this.#insDataWithConn(table, data);
                    }

                    // 更新数据 - 增强版，自动添加 updated_at，过滤敏感字段
                    async updData(table, data, where) {
                        return await this.#updDataWithConn(table, data, where);
                    }

                    // 删除数据
                    async delData(table, where) {
                        return await this.#delDataWithConn(table, where);
                    }

                    // 软删除数据 - 将 state 设置为 2
                    async delData2(table, where) {
                        return await this.#delData2WithConn(table, where);
                    }

                    // 批量插入 - 增强版，自动添加 ID 和时间戳
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

                        let conn;
                        try {
                            conn = await this.#pool.getConnection();
                            await conn.beginTransaction();

                            // 为回调函数提供连接对象和高级方法
                            const txMethods = {
                                // 原始SQL执行方法
                                query: async (sql, params = []) => {
                                    return await conn.query(sql, params);
                                },
                                execute: async (sql, params = []) => {
                                    return await conn.query(sql, params);
                                },

                                // 高级数据操作方法 - 直接调用私有方法，传入事务连接
                                getDetail: async (table, options = {}) => {
                                    return await this.#getDetailWithConn(table, options, conn);
                                },

                                getList: async (table, options = {}) => {
                                    return await this.#getListWithConn(table, options, conn);
                                },

                                getAll: async (table, options = {}) => {
                                    return await this.#getAllWithConn(table, options, conn);
                                },

                                insData: async (table, data) => {
                                    return await this.#insDataWithConn(table, data, conn);
                                },

                                updData: async (table, data, where) => {
                                    return await this.#updDataWithConn(table, data, where, conn);
                                },

                                delData: async (table, where) => {
                                    return await this.#delDataWithConn(table, where, conn);
                                },

                                delData2: async (table, where) => {
                                    return await this.#delData2WithConn(table, where, conn);
                                },

                                getCount: async (table, options = {}) => {
                                    return await this.#getCountWithConn(table, options, conn);
                                },

                                insBatch: async (table, dataArray) => {
                                    return await this.#insBatchWithConn(table, dataArray, conn);
                                }
                            };

                            const result = await callback(txMethods);

                            await conn.commit();
                            return result;
                        } catch (error) {
                            if (conn) {
                                try {
                                    await conn.rollback();
                                    Logger.info('事务已回滚');
                                } catch (rollbackError) {
                                    Logger.error('事务回滚失败:', rollbackError);
                                }
                            }
                            throw error;
                        } finally {
                            if (conn) {
                                try {
                                    conn.release();
                                } catch (releaseError) {
                                    Logger.warn('连接释放警告:', releaseError.message);
                                }
                            }
                        }
                    }

                    // 获取连接池状态
                    getPoolStatus() {
                        return {
                            activeConnections: this.#pool.activeConnections(),
                            totalConnections: this.#pool.totalConnections(),
                            idleConnections: this.#pool.idleConnections(),
                            taskQueueSize: this.#pool.taskQueueSize()
                        };
                    }

                    // 关闭连接池
                    async close() {
                        if (this.#pool) {
                            try {
                                await this.#pool.end();
                                Logger.info('数据库连接池已关闭');
                            } catch (error) {
                                Logger.error('关闭数据库连接池失败:', error);
                                throw error;
                            }
                        }
                    }
                }

                // 创建数据库管理器实例
                const dbManager = new DatabaseManager(pool);

                // 监听进程退出事件，确保连接池正确关闭
                const gracefulShutdown = async (signal) => {
                    Logger.info(`收到 ${signal} 信号，正在关闭数据库连接池...`);
                    try {
                        await dbManager.close();
                    } catch (error) {
                        Logger.error('优雅关闭数据库失败:', error);
                    }
                    process.exit(0);
                };

                process.on('SIGINT', gracefulShutdown);
                process.on('SIGTERM', gracefulShutdown);
                process.on('SIGUSR2', gracefulShutdown); // nodemon 重启

                return dbManager;
            } else {
                Logger.warn(`MySQL 未启用，跳过初始化`);
                return {};
            }
        } catch (error) {
            Logger.error({
                msg: '数据库初始化失败',
                message: error.message,
                stack: error.stack
            });

            // 清理资源
            if (pool) {
                try {
                    await pool.end();
                } catch (cleanupError) {
                    Logger.error('清理连接池失败:', cleanupError);
                }
            }

            process.exit(1);
        }
    }
};
