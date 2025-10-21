/**
 * Redis 助手 - TypeScript 版本
 * 提供 Redis 操作的便捷方法
 */

import { RedisClient } from 'bun';
import { Env } from '../config/env.js';
import { Logger } from './logger.js';
import { getRedis } from './database.js';

/**
 * Redis 键前缀
 */
const prefix = Env.REDIS_KEY_PREFIX ? `${Env.REDIS_KEY_PREFIX}:` : '';

/**
 * 获取 Redis 客户端
 * @returns Redis 客户端实例
 * @throws 如果客户端未初始化
 */
function getClient(): RedisClient {
    const client = getRedis();
    if (!client) {
        throw new Error('Redis 客户端未初始化，请先调用 initDatabase() 或 initRedisOnly()');
    }
    return client;
}

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
            const client = getClient();
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
            const client = getClient();
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
            const client = getClient();
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
     * 格式: 秒级时间戳(10位) + 4位自增 = 14位纯数字
     * 容量: 10000/秒 = 864,000,000/天
     * 范围: 到 2286年9月
     * @returns 唯一 ID (14位纯数字)
     */
    async genTimeID(): Promise<number> {
        const client = getClient();
        const timestamp = Math.floor(Date.now() / 1000); // 秒级时间戳
        const key = `${prefix}time_id_counter:${timestamp}`;

        const counter = await client.incr(key);
        await client.expire(key, 1);

        const counterSuffix = (counter % 10000).toString().padStart(4, '0');

        return Number(`${timestamp}${counterSuffix}`);
    },

    /**
     * 批量生成基于时间的唯一 ID
     * 格式: 秒级时间戳(10位) + 4位自增 = 14位纯数字
     * @param count - 需要生成的 ID 数量
     * @returns ID 数组 (14位纯数字)
     */
    async genTimeIDBatch(count: number): Promise<number[]> {
        if (count <= 0) {
            return [];
        }

        // 限制单次批量生成数量（每秒最多10000个）
        const MAX_BATCH_SIZE = 10000;
        if (count > MAX_BATCH_SIZE) {
            throw new Error(`批量大小 ${count} 超过最大限制 ${MAX_BATCH_SIZE}`);
        }

        const client = getClient();
        const timestamp = Math.floor(Date.now() / 1000); // 秒级时间戳
        const key = `${prefix}time_id_counter:${timestamp}`;

        // 使用 INCRBY 一次性获取 N 个连续计数
        const startCounter = await client.incrBy(key, count);
        await client.expire(key, 1);

        // 生成 ID 数组
        const ids: number[] = [];
        for (let i = 0; i < count; i++) {
            const counter = startCounter - count + i + 1; // 计算每个 ID 的计数值
            const counterSuffix = (counter % 10000).toString().padStart(4, '0');
            ids.push(Number(`${timestamp}${counterSuffix}`));
        }

        return ids;
    },

    /**
     * 设置字符串值
     * @param key - 键名
     * @param value - 值
     * @param ttl - 过期时间（秒）
     */
    async setString(key: string, value: string, ttl: number | null = null): Promise<string | null> {
        try {
            const client = getClient();
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
            const client = getClient();
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
            const client = getClient();
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
            const client = getClient();
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
            const client = getClient();
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
