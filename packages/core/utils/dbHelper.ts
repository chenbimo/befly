/**
 * Befly 数据库工具
 * 提供数据库连接和表名转换功能
 */

import { SQL } from 'bun';
import { Env } from '../config/env.js';
import { Logger } from './logger.js';
import type { SqlClientOptions } from '../types/database.js';

/**
 * 转换为蛇形命名（snake_case）
 * 用于将小驼峰命名的表名转换为数据库约定的蛇形命名
 * @param name - 小驼峰命名的字符串
 * @returns 蛇形命名的字符串
 *
 * @example
 * toSnakeTableName('userTable') // 'user_table'
 * toSnakeTableName('testNewFormat') // 'test_new_format'
 * toSnakeTableName('common') // 'common'
 * toSnakeTableName('APIKey') // 'api_key'
 */
export const toSnakeTableName = (name: string): string => {
    if (!name) return name;
    return String(name)
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1_$2')
        .toLowerCase();
};

/**
 * 构建数据库连接字符串
 * 根据环境变量自动构建 SQLite、PostgreSQL 或 MySQL 的连接 URL
 * @returns 数据库连接字符串
 * @throws 如果配置不完整或数据库类型不支持
 *
 * @example
 * // SQLite 内存数据库
 * buildDatabaseUrl() // 'sqlite://:memory:' (当 DB_NAME 为空或 ':memory:')
 *
 * // SQLite 文件数据库
 * buildDatabaseUrl() // 'sqlite://database.db'
 * buildDatabaseUrl() // 'sqlite://./data/app.db'
 * buildDatabaseUrl() // 'sqlite:///absolute/path/db.sqlite'
 *
 * // PostgreSQL
 * buildDatabaseUrl() // 'postgres://user:pass@localhost:5432/dbname'
 *
 * // MySQL
 * buildDatabaseUrl() // 'mysql://user:pass@localhost:3306/dbname'
 */
export const buildDatabaseUrl = (): string => {
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
};

/**
 * 创建 SQL 客户端
 * 根据配置创建并测试数据库连接
 * @param options - SQL 客户端选项
 * @returns SQL 客户端实例
 * @throws 如果连接失败
 *
 * @example
 * const sql = await createSqlClient();
 * const users = await sql`SELECT * FROM users`;
 *
 * // 自定义连接池大小
 * const sql = await createSqlClient({ max: 10 });
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
            bigint: options.bigint ?? true,
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
        Logger.error('数据库连接测试失败:', error.message || error);

        // 清理资源
        try {
            await sql.close();
        } catch (cleanupError) {
            // 忽略清理错误
        }

        throw error;
    }
}
