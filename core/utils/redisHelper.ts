/**
 * Redis 助手 - TypeScript 版本
 * 提供 Redis 操作的便捷方法
 */

import { redis as bunRedis } from 'bun';
import { Env } from '../config/env.js';
import { Logger } from './logger.js';

/**
 * Redis 客户端类型
 */
type RedisClient = typeof bunRedis;

/**
 * Redis 键前缀
 */
const prefix = Env.REDIS_KEY_PREFIX ? `${Env.REDIS_KEY_PREFIX}:` : '';

/**
 * Redis 客户端实例
 */
let redisClient: RedisClient = bunRedis;

/**
 * 设置 Redis 客户端
 * @param client - Redis 客户端实例
 */
export const setRedisClient = (client: RedisClient | null): void => {
    redisClient = client || bunRedis;
};

/**
 * 获取 Redis 客户端
 * @returns Redis 客户端实例
 */
export const getRedisClient = (): RedisClient => redisClient;

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
