/**
 * 数据库连接管理器
 * 统一管理 SQL 和 Redis 连接
 */

import type { DatabaseConfig, RedisConfig } from "../types/befly";

import { SQL, RedisClient } from "bun";

import { Logger } from "./logger";

/**
 * 数据库连接管理器
 * 使用静态方法管理全局单例连接
 */
export class Connect {
    private static sqlClient: SQL | null = null;
    private static redisClient: RedisClient | null = null;

    // 连接统计信息
    private static sqlConnectedAt: number | null = null;
    private static redisConnectedAt: number | null = null;
    private static sqlPoolMax: number = 1;

    // MySQL 版本信息（用于启动期校验与监控）
    private static mysqlVersionText: string | null = null;
    private static mysqlVersionMajor: number | null = null;

    // ========================================
    // SQL 连接管理
    // ========================================

    /**
     * 连接 SQL 数据库
     * @returns SQL 客户端实例
     */
    static async connectSql(dbConfig: DatabaseConfig): Promise<SQL> {
        const config = dbConfig || {};

        // 构建 MySQL 连接字符串（不做隐式默认；缺失直接报错，避免连错库/错密码）
        const host = typeof config.host === "string" ? config.host.trim() : "";
        const port = typeof config.port === "number" ? config.port : NaN;
        const username = typeof config.username === "string" ? config.username.trim() : "";
        const password = config.password === undefined ? "" : typeof config.password === "string" ? config.password : "";
        const database = typeof config.database === "string" ? config.database.trim() : "";

        if (!host) {
            throw new Error("数据库配置不完整：db.host 缺失");
        }
        if (!Number.isFinite(port) || port < 1 || port > 65535) {
            throw new Error(`数据库配置不完整：db.port 非法（当前值：${String(config.port)}）`);
        }
        if (!username) {
            throw new Error("数据库配置不完整：db.username 缺失");
        }
        if (!database) {
            throw new Error("数据库配置不完整：db.database 缺失");
        }

        const user = encodeURIComponent(username);
        const pass = encodeURIComponent(password);
        const db = encodeURIComponent(database);

        const finalUrl = `mysql://${user}:${pass}@${host}:${port}/${db}`;

        const sql = new SQL({
            url: finalUrl,
            max: config.poolMax ?? 1,
            bigint: false
        });

        try {
            const timeout = 30000;

            const healthCheckPromise = (async () => {
                const v = await sql`SELECT VERSION() AS version`;
                const versionText = typeof v?.[0]?.version === "string" ? v?.[0]?.version : String(v?.[0]?.version || "");

                // 常见格式：8.0.36 / 8.0.36-xxx
                const majorText = versionText.split(".")[0];
                const major = Number(majorText);
                if (!Number.isFinite(major)) {
                    throw new Error(`无法解析 MySQL 版本信息: ${versionText}`);
                }
                if (major < 8) {
                    throw new Error(`仅支持 MySQL 8.0+，当前版本：${versionText}`);
                }

                this.mysqlVersionText = versionText;
                this.mysqlVersionMajor = major;

                return versionText;
            })();

            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`数据库连接超时 (${timeout}ms)`));
                }, timeout);
            });

            await Promise.race([healthCheckPromise, timeoutPromise]);

            this.sqlClient = sql;
            this.sqlConnectedAt = Date.now();
            this.sqlPoolMax = config.poolMax ?? 1;
            return sql;
        } catch (error: any) {
            Logger.error({ err: error, msg: "[Connect] SQL 连接失败" });
            try {
                await sql?.close();
            } catch {}

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
                Logger.error({ err: error, msg: "[Connect] 关闭 SQL 连接时出错" });
            }
            this.sqlClient = null;
            this.sqlConnectedAt = null;
        }
    }

    /**
     * 获取 SQL 客户端实例
     * @throws 如果未连接则抛出错误
     */
    static getSql(): SQL {
        if (!this.sqlClient) {
            throw new Error("SQL 客户端未连接，请先调用 Connect.connectSql()");
        }
        return this.sqlClient;
    }

    // ========================================
    // Redis 连接管理
    // ========================================

    /**
     * 连接 Redis
     * @returns Redis 客户端实例
     */
    static async connectRedis(redisConfig: RedisConfig): Promise<RedisClient> {
        const config = redisConfig || {};

        try {
            // 构建 Redis URL
            const host = config.host || "127.0.0.1";
            const port = config.port || 6379;
            const username = config.username || "";
            const password = config.password || "";
            const db = config.db || 0;

            let auth = "";
            const encodedUsername = username ? encodeURIComponent(username) : "";
            const encodedPassword = password ? encodeURIComponent(password) : "";
            if (encodedUsername && encodedPassword) {
                auth = `${encodedUsername}:${encodedPassword}@`;
            } else if (encodedPassword) {
                auth = `:${encodedPassword}@`;
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
            this.redisConnectedAt = Date.now();
            return redis;
        } catch (error: any) {
            Logger.error({ err: error, msg: "[Connect] Redis 连接失败" });
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
                this.redisConnectedAt = null;
            } catch (error: any) {
                Logger.error({ err: error, msg: "[Connect] 关闭 Redis 连接时出错" });
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
            throw new Error("Redis 客户端未连接，请先调用 Connect.connectRedis()");
        }
        return this.redisClient;
    }

    // ========================================
    // 统一连接管理
    // ========================================

    /**
     * 连接所有数据库（SQL + Redis）
     */
    static async connect(config: { db: DatabaseConfig; redis: RedisConfig }): Promise<void> {
        try {
            // 连接 SQL
            await this.connectSql(config.db || {});

            // 连接 Redis
            await this.connectRedis(config.redis || {});
        } catch (error: any) {
            const env = typeof process?.env?.NODE_ENV === "string" ? process.env.NODE_ENV : "";
            Logger.error({ env: env, err: error, msg: "数据库连接初始化失败" });
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

    /**
     * 获取连接状态详细信息（用于监控和调试）
     */
    static getStatus(): {
        sql: {
            connected: boolean;
            connectedAt: number | null;
            uptime: number | null;
            poolMax: number;
            mysqlVersionText: string | null;
            mysqlVersionMajor: number | null;
        };
        redis: {
            connected: boolean;
            connectedAt: number | null;
            uptime: number | null;
        };
    } {
        const now = Date.now();
        return {
            sql: {
                connected: this.sqlClient !== null,
                connectedAt: this.sqlConnectedAt,
                uptime: this.sqlConnectedAt ? now - this.sqlConnectedAt : null,
                poolMax: this.sqlPoolMax,
                mysqlVersionText: this.mysqlVersionText,
                mysqlVersionMajor: this.mysqlVersionMajor
            },
            redis: {
                connected: this.redisClient !== null,
                connectedAt: this.redisConnectedAt,
                uptime: this.redisConnectedAt ? now - this.redisConnectedAt : null
            }
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
        this.sqlConnectedAt = null;
        this.redisConnectedAt = null;
        this.sqlPoolMax = 1;
        this.mysqlVersionText = null;
        this.mysqlVersionMajor = null;
    }
}
