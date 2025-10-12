/**
 * Redis 助手 - TypeScript 版本
 * 提供 Redis 操作的便捷方法
 */

import { RedisClient } from 'bun';
import { Env } from '../config/env.js';
import { Logger } from './logger.js';

/**
 * Redis 键前缀
 */
const prefix = Env.REDIS_KEY_PREFIX ? `${Env.REDIS_KEY_PREFIX}:` : '';

/**
 * 构建 Redis 连接 URL
 * @returns Redis 连接 URL
 */
function buildRedisUrl(): string {
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
 * Redis 客户端实例
 */
let redisClient: RedisClient | null = null;

/**
 * 初始化 Redis 客户端
 * @returns Redis 客户端实例
 * @throws 如果连接失败
 */
export const initRedisClient = async (): Promise<RedisClient> => {
    if (!redisClient) {
        try {
            const url = buildRedisUrl();
            redisClient = new RedisClient(url, {
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
            await redisClient.ping();
            Logger.info('Redis 连接成功');
        } catch (error: any) {
            redisClient = null;
            Logger.error({
                msg: 'Redis 连接失败',
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            throw new Error(`Redis 连接失败: ${error.message}`);
        }
    }
    return redisClient;
};

/**
 * 获取 Redis 客户端
 * @returns Redis 客户端实例
 * @throws 如果连接失败
 */
export const getRedisClient = async (): Promise<RedisClient> => {
    if (!redisClient) {
        return await initRedisClient();
    }
    return redisClient;
};

/**
 * 关闭 Redis 连接
 */
export const closeRedisClient = (): void => {
    if (redisClient) {
        redisClient.close();
        redisClient = null;
    }
};

/**
 * Redis 助手对象
 */
export const RedisHelper = {
    /**
     * 获取 Redis 客户端实例
     * @returns Redis 客户端
     * @throws 如果连接失败
     */
    async getRedisClient(): Promise<RedisClient> {
        return await getRedisClient();
    },

    /**
     * 设置对象到 Redis
     * @param key - 键名
     * @param obj - 对象
     * @param ttl - 过期时间（秒）
     * @returns 操作结果
     */
    async setObject<T = any>(key: string, obj: T, ttl: number | null = null): Promise<string | null> {
        try {
            const client = await getRedisClient();
            const data = JSON.stringify(obj);
            const pkey = `${prefix}${key}`;

            if (ttl) {
                return await client.setEx(pkey, ttl, data);
            }
            return await client.set(pkey, data);
        } catch (error: any) {
            Logger.error({
                msg: 'Redis setObject 错误',
                message: error.message,
                stack: error.stack
            });
            return null;
        }
    },

    /**
     * 从 Redis 获取对象
     * @param key - 键名
     * @returns 对象或 null
     */
    async getObject<T = any>(key: string): Promise<T | null> {
        try {
            const client = await getRedisClient();
            const pkey = `${prefix}${key}`;
            const data = await client.get(pkey);
            return data ? JSON.parse(data) : null;
        } catch (error: any) {
            Logger.error({
                msg: 'Redis getObject 错误',
                message: error.message,
                stack: error.stack
            });
            return null;
        }
    },

    /**
     * 从 Redis 删除对象
     * @param key - 键名
     */
    async delObject(key: string): Promise<void> {
        try {
            const client = await getRedisClient();
            const pkey = `${prefix}${key}`;
            await client.del(pkey);
        } catch (error: any) {
            Logger.error({
                msg: 'Redis delObject 错误',
                message: error.message,
                stack: error.stack
            });
        }
    },

    /**
     * 生成基于时间的唯一 ID
     * @returns 唯一 ID
     */
    async genTimeID(): Promise<number> {
        const client = await getRedisClient();
        const timestamp = Math.floor(Date.now() / 1000);
        const key = `${prefix}time_id_counter:${timestamp}`;

        const counter = await client.incr(key);
        await client.expire(key, 2);

        const counterPrefix = (counter % 1000).toString().padStart(3, '0');
        const randomSuffix = Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, '0');
        const suffix = `${counterPrefix}${randomSuffix}`;

        return Number(`${timestamp}${suffix}`);
    },

    /**
     * 设置字符串值
     * @param key - 键名
     * @param value - 值
     * @param ttl - 过期时间（秒）
     */
    async setString(key: string, value: string, ttl: number | null = null): Promise<string | null> {
        try {
            const client = await getRedisClient();
            const pkey = `${prefix}${key}`;
            if (ttl) {
                return await client.setEx(pkey, ttl, value);
            }
            return await client.set(pkey, value);
        } catch (error: any) {
            Logger.error({
                msg: 'Redis setString 错误',
                message: error.message,
                stack: error.stack
            });
            return null;
        }
    },

    /**
     * 获取字符串值
     * @param key - 键名
     */
    async getString(key: string): Promise<string | null> {
        try {
            const client = await getRedisClient();
            const pkey = `${prefix}${key}`;
            return await client.get(pkey);
        } catch (error: any) {
            Logger.error({
                msg: 'Redis getString 错误',
                message: error.message,
                stack: error.stack
            });
            return null;
        }
    },

    /**
     * 检查键是否存在
     * @param key - 键名
     */
    async exists(key: string): Promise<number> {
        try {
            const client = await getRedisClient();
            const pkey = `${prefix}${key}`;
            return await client.exists(pkey);
        } catch (error: any) {
            Logger.error({
                msg: 'Redis exists 错误',
                message: error.message,
                stack: error.stack
            });
            return 0;
        }
    },

    /**
     * 设置过期时间
     * @param key - 键名
     * @param seconds - 秒数
     */
    async expire(key: string, seconds: number): Promise<number> {
        try {
            const client = await getRedisClient();
            const pkey = `${prefix}${key}`;
            return await client.expire(pkey, seconds);
        } catch (error: any) {
            Logger.error({
                msg: 'Redis expire 错误',
                message: error.message,
                stack: error.stack
            });
            return 0;
        }
    },

    /**
     * 获取剩余过期时间
     * @param key - 键名
     */
    async ttl(key: string): Promise<number> {
        try {
            const client = await getRedisClient();
            const pkey = `${prefix}${key}`;
            return await client.ttl(pkey);
        } catch (error: any) {
            Logger.error({
                msg: 'Redis ttl 错误',
                message: error.message,
                stack: error.stack
            });
            return -1;
        }
    }
};
