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
 */
export const initRedisClient = (): RedisClient => {
    if (!redisClient) {
        const url = buildRedisUrl();
        redisClient = new RedisClient(url, {
            // 连接超时（毫秒）
            connectionTimeout: 10000,
            // 空闲超时（毫秒），0 表示无超时
            idleTimeout: 30000,
            // 断开连接时自动重连
            autoReconnect: true,
            // 最大重连次数
            maxRetries: 10,
            // 断开连接时缓存命令
            enableOfflineQueue: true,
            // 自动管道化命令
            enableAutoPipelining: true
        });
    }
    return redisClient;
};

/**
 * 获取 Redis 客户端
 * @returns Redis 客户端实例
 */
export const getRedisClient = (): RedisClient => {
    if (!redisClient) {
        return initRedisClient();
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
     * 设置对象到 Redis
     * @param key - 键名
     * @param obj - 对象
     * @param ttl - 过期时间（秒）
     * @returns 操作结果
     */
    async setObject<T = any>(key: string, obj: T, ttl: number | null = null): Promise<string | null> {
        try {
            const data = JSON.stringify(obj);
            const pkey = `${prefix}${key}`;

            if (ttl) {
                return await redisClient.setEx(pkey, ttl, data);
            }
            return await redisClient.set(pkey, data);
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
            const pkey = `${prefix}${key}`;
            const data = await redisClient.get(pkey);
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
            const pkey = `${prefix}${key}`;
            await redisClient.del(pkey);
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
        const timestamp = Math.floor(Date.now() / 1000);
        const key = `${prefix}time_id_counter:${timestamp}`;

        const counter = await redisClient.incr(key);
        await redisClient.expire(key, 2);

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
            const pkey = `${prefix}${key}`;
            if (ttl) {
                return await redisClient.setEx(pkey, ttl, value);
            }
            return await redisClient.set(pkey, value);
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
            const pkey = `${prefix}${key}`;
            return await redisClient.get(pkey);
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
            const pkey = `${prefix}${key}`;
            return await redisClient.exists(pkey);
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
            const pkey = `${prefix}${key}`;
            return await redisClient.expire(pkey, seconds);
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
            const pkey = `${prefix}${key}`;
            return await redisClient.ttl(pkey);
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
