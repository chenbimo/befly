/**
 * 数据库统一管理工具
 * 提供 Redis 和 SQL 连接的统一初始化和管理
 */

import { SQL, RedisClient } from 'bun';
import { Env } from '../config/env.js';
import { Logger } from './logger.js';
import { DbHelper } from '../lib/dbHelper.js';
import { RedisHelper } from '../lib/redisHelper.js';
import type { BeflyContext } from '../types/befly.js';
import type { SqlClientOptions } from '../types/database.js';

/**
 * 数据库连接实例
 */
interface DatabaseConnections {
    redis: RedisClient | null;
    sql: any;
    helper: DbHelper | null;
}

/**
 * 全局连接实例
 */
const connections: DatabaseConnections = {
    redis: null,
    sql: null,
    helper: null
};

/**
 * 构建 Redis 连接 URL
 * @returns Redis 连接 URL
 */
export function buildRedisUrl(): string {
    const { REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD, REDIS_DB } = Env;

    // 构建认证部分
    let auth = '';
    if (REDIS_USERNAME && REDIS_PASSWORD) {
        auth = `${REDIS_USERNAME}:${REDIS_PASSWORD}@`;
    } else if (REDIS_PASSWORD) {
        auth = `:${REDIS_PASSWORD}@`;
    }

    // 构建完整 URL
    const url = `redis://${auth}${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`;

    return url;
}

/**
 * 构建数据库连接字符串
 * 根据环境变量自动构建 SQLite、PostgreSQL 或 MySQL 的连接 URL
 * @returns 数据库连接字符串
 * @throws 如果配置不完整或数据库类型不支持
 */
export function buildDatabaseUrl(): string {
    const type = Env.DB_TYPE || '';
    const host = Env.DB_HOST || '';
    const port = Env.DB_PORT;
    const user = encodeURIComponent(Env.DB_USER || '');
    const pass = encodeURIComponent(Env.DB_PASS || '');
    const name = Env.DB_NAME || '';

    if (!type) throw new Error('DB_TYPE 未配置');
    if (!name && type !== 'sqlite') throw new Error('DB_NAME 未配置');

    if (type === 'sqlite') {
        // 支持内存数据库
        if (!name || name === ':memory:') {
            return 'sqlite://:memory:';
        }
        // 支持绝对路径（以 / 或盘符开头，如 /path 或 C:\path）
        if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) {
            return `sqlite://${name}`;
        }
        // 相对路径和普通文件名
        return `sqlite://${name}`;
    }

    if (type === 'postgresql' || type === 'postgres') {
        if (!host || !port) throw new Error('DB_HOST/DB_PORT 未配置');
        const auth = user || pass ? `${user}:${pass}@` : '';
        return `postgres://${auth}${host}:${port}/${encodeURIComponent(name)}`;
    }

    if (type === 'mysql') {
        if (!host || !port) throw new Error('DB_HOST/DB_PORT 未配置');
        const auth = user || pass ? `${user}:${pass}@` : '';
        return `mysql://${auth}${host}:${port}/${encodeURIComponent(name)}`;
    }

    throw new Error(`不支持的 DB_TYPE: ${type}`);
}

/**
 * 创建 Redis 客户端
 * @returns Redis 客户端实例
 * @throws 如果连接失败
 */
export async function createRedisClient(): Promise<RedisClient> {
    try {
        const url = buildRedisUrl();
        const redis = new RedisClient(url, {
            // 连接超时（毫秒）
            connectionTimeout: 10000,
            // 空闲超时设为 0，表示永不超时
            idleTimeout: 0,
            // 断开连接时自动重连
            autoReconnect: true,
            // 最大重连次数，0 表示无限重连
            maxRetries: 0,
            // 断开连接时缓存命令
            enableOfflineQueue: true,
            // 自动管道化命令
            enableAutoPipelining: true
        });

        // 测试连接是否成功
        await redis.ping();
        Logger.info('Redis 连接成功');

        return redis;
    } catch (error: any) {
        Logger.error('Redis 连接失败', error);
        throw new Error(`Redis 连接失败: ${error.message}`);
    }
}

/**
 * 创建 SQL 客户端
 * @param options SQL 客户端选项
 * @returns SQL 客户端实例
 * @throws 如果连接失败
 */
export async function createSqlClient(options: SqlClientOptions = {}): Promise<any> {
    const finalUrl = buildDatabaseUrl();
    let sql: any = null;

    if (Env.DB_TYPE === 'sqlite') {
        sql = new SQL(finalUrl);
    } else {
        sql = new SQL({
            url: finalUrl,
            max: options.max ?? 1,
            bigint: false,
            ...options
        });
    }

    try {
        // 连接健康检查 - 添加超时机制
        const timeout = options.connectionTimeout ?? 5000; // 默认5秒超时

        const healthCheckPromise = (async () => {
            let version = '';
            if (Env.DB_TYPE === 'sqlite') {
                const v = await sql`SELECT sqlite_version() AS version`;
                version = v?.[0]?.version;
            } else if (Env.DB_TYPE === 'postgresql' || Env.DB_TYPE === 'postgres') {
                const v = await sql`SELECT version() AS version`;
                version = v?.[0]?.version;
            } else {
                const v = await sql`SELECT VERSION() AS version`;
                version = v?.[0]?.version;
            }
            return version;
        })();

        // 创建超时 Promise
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`数据库连接超时 (${timeout}ms)`));
            }, timeout);
        });

        // 使用 Promise.race 实现超时控制
        const version = await Promise.race([healthCheckPromise, timeoutPromise]);

        Logger.info(`数据库连接成功，version: ${version}`);
        return sql;
    } catch (error: any) {
        Logger.error('数据库连接测试失败', error);

        // 清理资源
        try {
            await sql.close();
        } catch (cleanupError) {
            // 忽略清理错误
        }

        throw error;
    }
}

/**
 * 初始化数据库连接（Redis + SQL）
 * @param options SQL 客户端选项
 * @returns 数据库连接实例
 */
export async function initDatabase(options: SqlClientOptions = {}): Promise<DatabaseConnections> {
    try {
        // 1. 初始化 Redis
        Logger.info('正在初始化 Redis 连接...');
        connections.redis = await createRedisClient();

        // 2. 初始化 SQL
        Logger.info('正在初始化 SQL 连接...');
        connections.sql = await createSqlClient(options);

        // 3. 创建 DbHelper 实例
        const befly: BeflyContext = {
            redis: RedisHelper, // 使用 RedisHelper 对象而不是 RedisClient
            db: null as any,
            tool: null as any,
            logger: null as any
        };
        connections.helper = new DbHelper(befly, connections.sql);

        Logger.info('数据库连接初始化完成（Redis + SQL + DbHelper）');

        return {
            redis: connections.redis,
            sql: connections.sql,
            helper: connections.helper
        };
    } catch (error: any) {
        Logger.error('数据库初始化失败', error);
        // 清理已创建的连接
        await closeDatabase();
        throw error;
    }
}

/**
 * 关闭所有数据库连接
 */
export async function closeDatabase(): Promise<void> {
    try {
        // 关闭 SQL 连接
        if (connections.sql) {
            try {
                await connections.sql.close();
                Logger.info('SQL 连接已关闭');
            } catch (error: any) {
                Logger.warn('关闭 SQL 连接时出错:', error.message);
            }
            connections.sql = null;
        }

        // 关闭 Redis 连接
        if (connections.redis) {
            try {
                connections.redis.close();
                Logger.info('Redis 连接已关闭');
            } catch (error: any) {
                Logger.warn('关闭 Redis 连接时出错:', error);
            }
            connections.redis = null;
        }

        // 清理 DbHelper
        connections.helper = null;
    } catch (error: any) {
        Logger.error('关闭数据库连接时出错', error);
    }
}

/**
 * 获取 Redis 客户端
 * @returns Redis 客户端实例
 */
export function getRedis(): RedisClient | null {
    return connections.redis;
}

/**
 * 获取 SQL 客户端
 * @returns SQL 客户端实例
 */
export function getSql(): any {
    return connections.sql;
}

/**
 * 获取 DbHelper 实例
 * @returns DbHelper 实例
 */
export function getDbHelper(): DbHelper | null {
    return connections.helper;
}

/**
 * 检查数据库连接是否已初始化
 * @returns 是否已初始化
 */
export function isDatabaseInitialized(): boolean {
    return connections.redis !== null && connections.sql !== null && connections.helper !== null;
}

/**
 * 仅初始化 SQL 连接（不需要 Redis 时使用）
 * @param options SQL 客户端选项
 * @returns SQL 客户端和 DbHelper 实例
 */
export async function initSqlOnly(options: SqlClientOptions = {}): Promise<{ sql: any; helper: DbHelper }> {
    try {
        Logger.info('正在初始化 SQL 连接（不含 Redis）...');
        connections.sql = await createSqlClient(options);

        // 创建最小化 befly 上下文（不含 redis）
        const befly: BeflyContext = {
            redis: null as any,
            db: null as any,
            tool: null as any,
            logger: null as any
        };
        connections.helper = new DbHelper(befly, connections.sql);

        Logger.info('SQL 连接初始化完成');

        return {
            sql: connections.sql,
            helper: connections.helper
        };
    } catch (error: any) {
        Logger.error('SQL 初始化失败', error);
        throw error;
    }
}

/**
 * 仅初始化 Redis 连接（不需要 SQL 时使用）
 * @returns Redis 客户端实例
 */
export async function initRedisOnly(): Promise<RedisClient> {
    try {
        Logger.info('正在初始化 Redis 连接（不含 SQL）...');
        connections.redis = await createRedisClient();
        Logger.info('Redis 连接初始化完成');
        return connections.redis;
    } catch (error: any) {
        Logger.error('Redis 初始化失败', error);
        throw error;
    }
}
