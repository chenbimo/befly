/**
 * 数据库连接管理器
 * 统一管理 SQL 和 Redis 连接
 */

import { SQL, RedisClient } from 'bun';
import { Logger } from './logger.js';
import { DbHelper } from './dbHelper.js';
import { RedisHelper } from './redisHelper.js';
import type { BeflyContext, DatabaseConfig, RedisConfig } from '../types/befly.js';
import type { SqlClientOptions } from '../types/database.js';

/**
 * 数据库连接管理器
 * 使用静态方法管理全局单例连接
 */
export class Connect {
    private static sqlClient: SQL | null = null;
    private static redisClient: RedisClient | null = null;
    private static dbHelper: DbHelper | null = null;

    // ========================================
    // SQL 连接管理
    // ========================================

    /**
     * 连接 SQL 数据库
     * @param config - 数据库配置
     * @returns SQL 客户端实例
     */
    static async connectSql(config: DatabaseConfig): Promise<SQL> {
        // 构建数据库连接字符串
        const type = config.type || 'mysql';
        const host = config.host || '127.0.0.1';
        const port = config.port || 3306;
        const user = encodeURIComponent(config.username || 'root');
        const password = encodeURIComponent(config.password || 'root');
        const database = encodeURIComponent(config.database || 'befly_demo');

        let finalUrl: string;
        if (type === 'sqlite') {
            finalUrl = database;
        } else {
            if (!host || !database) {
                throw new Error('数据库配置不完整，请检查配置参数');
            }
            finalUrl = `${type}://${user}:${password}@${host}:${port}/${database}`;
        }

        let sql: SQL;

        if (type === 'sqlite') {
            sql = new SQL(finalUrl);
        } else {
            sql = new SQL({
                url: finalUrl,
                max: config.poolMax ?? 1,
                bigint: false
            });
        }

        try {
            const timeout = 30000;

            const healthCheckPromise = (async () => {
                let version = '';
                if (type === 'sqlite') {
                    const v = await sql`SELECT sqlite_version() AS version`;
                    version = v?.[0]?.version;
                } else if (type === 'postgresql' || type === 'postgres') {
                    const v = await sql`SELECT version() AS version`;
                    version = v?.[0]?.version;
                } else {
                    const v = await sql`SELECT VERSION() AS version`;
                    version = v?.[0]?.version;
                }
                return version;
            })();

            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`数据库连接超时 (${timeout}ms)`));
                }, timeout);
            });

            const version = await Promise.race([healthCheckPromise, timeoutPromise]);

            this.sqlClient = sql;
            return sql;
        } catch (error: any) {
            console.log(finalUrl);
            Logger.error('数据库连接测试失败', error);

            try {
                await sql?.close();
            } catch (cleanupError) {}

            throw error;
        }
    }

    /**
     * 断开 SQL 连接
     */
    static async disconnectSql(): Promise<void> {
        if (this.sqlClient) {
            try {
                await this.sqlClient.close();
            } catch (error: any) {
                Logger.error('关闭 SQL 连接时出错', error);
            }
            this.sqlClient = null;
        }

        if (this.dbHelper) {
            this.dbHelper = null;
        }
    }

    /**
     * 获取 SQL 客户端实例
     * @throws 如果未连接则抛出错误
     */
    static getSql(): SQL {
        if (!this.sqlClient) {
            throw new Error('SQL 客户端未连接，请先调用 Connect.connectSql()');
        }
        return this.sqlClient;
    }

    /**
     * 获取 DbHelper 实例
     * @throws 如果未连接则抛出错误
     */
    static getDbHelper(befly?: BeflyContext): DbHelper {
        if (!this.dbHelper) {
            if (!this.sqlClient) {
                throw new Error('SQL 客户端未连接，请先调用 Connect.connectSql()');
            }
            // 创建临时 befly 上下文（仅用于 DbHelper）
            const ctx = befly || {
                redis: new RedisHelper(),
                db: null as any,
                tool: null as any,
                logger: null as any
            };
            this.dbHelper = new DbHelper(ctx, this.sqlClient);
        }
        return this.dbHelper;
    }

    // ========================================
    // Redis 连接管理
    // ========================================

    /**
     * 连接 Redis
     * @param config - Redis 配置
     * @returns Redis 客户端实例
     */
    static async connectRedis(config: RedisConfig = {}): Promise<RedisClient> {
        try {
            // 构建 Redis URL
            const host = config.host || '127.0.0.1';
            const port = config.port || 6379;
            const username = config.username || '';
            const password = config.password || '';
            const db = config.db || 0;

            let auth = '';
            if (username && password) {
                auth = `${username}:${password}@`;
            } else if (password) {
                auth = `:${password}@`;
            }

            const url = `redis://${auth}${host}:${port}/${db}`;

            const redis = new RedisClient(url, {
                connectionTimeout: 30000,
                idleTimeout: 0,
                autoReconnect: true,
                maxRetries: 3,
                enableOfflineQueue: true,
                enableAutoPipelining: true
            });

            await redis.ping();

            this.redisClient = redis;
            return redis;
        } catch (error: any) {
            Logger.error('Redis 连接失败', error);
            throw new Error(`Redis 连接失败: ${error.message}`);
        }
    }

    /**
     * 断开 Redis 连接
     */
    static async disconnectRedis(): Promise<void> {
        if (this.redisClient) {
            try {
                this.redisClient.close();
            } catch (error: any) {
                Logger.error('关闭 Redis 连接时出错', error);
            }
            this.redisClient = null;
        }
    }

    /**
     * 获取 Redis 客户端实例
     * @throws 如果未连接则抛出错误
     */
    static getRedis(): RedisClient {
        if (!this.redisClient) {
            throw new Error('Redis 客户端未连接，请先调用 Connect.connectRedis()');
        }
        return this.redisClient;
    }

    // ========================================
    // 统一连接管理
    // ========================================

    /**
     * 连接所有数据库（SQL + Redis）
     * @param options - 配置选项
     */
    static async connect(options?: { sql?: SqlClientOptions; redis?: boolean }): Promise<void> {
        try {
            if (options?.sql !== false) {
                await this.connectSql(options?.sql);
            }

            if (options?.redis !== false) {
                await this.connectRedis();
            }
        } catch (error: any) {
            Logger.error('数据库初始化失败', error);
            await this.disconnect();
            throw error;
        }
    }

    /**
     * 断开所有数据库连接
     */
    static async disconnect(): Promise<void> {
        await this.disconnectSql();
        await this.disconnectRedis();
    }

    /**
     * 检查连接状态
     */
    static isConnected(): { sql: boolean; redis: boolean } {
        return {
            sql: this.sqlClient !== null,
            redis: this.redisClient !== null
        };
    }

    // ========================================
    // 测试辅助方法
    // ========================================

    /**
     * 设置 mock SQL 客户端（仅用于测试）
     */
    static __setMockSql(mockClient: SQL): void {
        this.sqlClient = mockClient;
    }

    /**
     * 设置 mock Redis 客户端（仅用于测试）
     */
    static __setMockRedis(mockClient: RedisClient): void {
        this.redisClient = mockClient;
    }

    /**
     * 重置所有连接状态（仅用于测试）
     */
    static __reset(): void {
        this.sqlClient = null;
        this.redisClient = null;
        this.dbHelper = null;
    }
}
