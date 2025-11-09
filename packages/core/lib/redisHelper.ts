/**
 * Redis 助手 - TypeScript 版本
 * 提供 Redis 操作的便捷方法
 */

import { RedisClient } from 'bun';
import { Env } from '../env.js';
import { Logger } from '../lib/logger.js';
import { Database } from './database.js';

/**
 * Redis 键前缀
 */
const prefix = Env.REDIS_KEY_PREFIX ? `${Env.REDIS_KEY_PREFIX}:` : '';

/**
 * Redis 助手类
 */
export class RedisHelper {
    private client: RedisClient;

    /**
     * 构造函数
     */
    constructor() {
        const client = Database.getRedis();
        if (!client) {
            throw new Error('Redis 客户端未初始化，请先调用 Database.connectRedis()');
        }
        this.client = client;
    }

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
                return await this.client.setex(pkey, ttl, data);
            }
            return await this.client.set(pkey, data);
        } catch (error: any) {
            Logger.error('Redis setObject 错误', error);
            return null;
        }
    }

    /**
     * 从 Redis 获取对象
     * @param key - 键名
     * @returns 对象或 null
     */
    async getObject<T = any>(key: string): Promise<T | null> {
        try {
            const pkey = `${prefix}${key}`;
            const data = await this.client.get(pkey);
            return data ? JSON.parse(data) : null;
        } catch (error: any) {
            Logger.error('Redis getObject 错误', error);
            return null;
        }
    }

    /**
     * 从 Redis 删除对象
     * @param key - 键名
     */
    async delObject(key: string): Promise<void> {
        try {
            const pkey = `${prefix}${key}`;
            await this.client.del(pkey);
        } catch (error: any) {
            Logger.error('Redis delObject 错误', error);
        }
    }

    /**
     * 生成基于时间的唯一 ID
     * 格式: 秒级时间戳(10位) + 4位自增 = 14位纯数字
     * 容量: 10000/秒 = 864,000,000/天
     * 范围: 到 2286年9月
     * @returns 唯一 ID (14位纯数字)
     */
    async genTimeID(): Promise<number> {
        const timestamp = Math.floor(Date.now() / 1000); // 秒级时间戳
        const key = `${prefix}time_id_counter:${timestamp}`;

        const counter = await this.client.incr(key);
        await this.client.expire(key, 1);

        const counterSuffix = (counter % 10000).toString().padStart(4, '0');

        return Number(`${timestamp}${counterSuffix}`);
    }

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

        const timestamp = Math.floor(Date.now() / 1000); // 秒级时间戳
        const key = `${prefix}time_id_counter:${timestamp}`;

        // 使用 INCRBY 一次性获取 N 个连续计数
        const startCounter = await this.client.incrby(key, count);
        await this.client.expire(key, 1);

        // 生成 ID 数组
        const ids: number[] = [];
        for (let i = 0; i < count; i++) {
            const counter = startCounter - count + i + 1; // 计算每个 ID 的计数值
            const counterSuffix = (counter % 10000).toString().padStart(4, '0');
            ids.push(Number(`${timestamp}${counterSuffix}`));
        }

        return ids;
    }

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
                return await this.client.setex(pkey, ttl, value);
            }
            return await this.client.set(pkey, value);
        } catch (error: any) {
            Logger.error('Redis setString 错误', error);
            return null;
        }
    }

    /**
     * 获取字符串值
     * @param key - 键名
     */
    async getString(key: string): Promise<string | null> {
        try {
            const pkey = `${prefix}${key}`;
            return await this.client.get(pkey);
        } catch (error: any) {
            Logger.error('Redis getString 错误', error);
            return null;
        }
    }

    /**
     * 检查键是否存在
     * @param key - 键名
     */
    async exists(key: string): Promise<number> {
        try {
            const pkey = `${prefix}${key}`;
            return await this.client.exists(pkey);
        } catch (error: any) {
            Logger.error('Redis exists 错误', error);
            return 0;
        }
    }

    /**
     * 设置过期时间
     * @param key - 键名
     * @param seconds - 秒数
     */
    async expire(key: string, seconds: number): Promise<number> {
        try {
            const pkey = `${prefix}${key}`;
            return await this.client.expire(pkey, seconds);
        } catch (error: any) {
            Logger.error('Redis expire 错误', error);
            return 0;
        }
    }

    /**
     * 获取剩余过期时间
     * @param key - 键名
     */
    async ttl(key: string): Promise<number> {
        try {
            const pkey = `${prefix}${key}`;
            return await this.client.ttl(pkey);
        } catch (error: any) {
            Logger.error('Redis ttl 错误', error);
            return -1;
        }
    }

    /**
     * 向 Set 中添加一个或多个成员
     * @param key - 键名
     * @param members - 成员数组
     * @returns 成功添加的成员数量
     */
    async sadd(key: string, members: string[]): Promise<number> {
        try {
            if (members.length === 0) return 0;

            const pkey = `${prefix}${key}`;
            return await this.client.sadd(pkey, ...members);
        } catch (error: any) {
            Logger.error('Redis sadd 错误', error);
            return 0;
        }
    }

    /**
     * 判断成员是否在 Set 中
     * @param key - 键名
     * @param member - 成员
     * @returns 1 表示存在，0 表示不存在
     */
    async sismember(key: string, member: string): Promise<number> {
        try {
            const pkey = `${prefix}${key}`;
            return await this.client.sismember(pkey, member);
        } catch (error: any) {
            Logger.error('Redis sismember 错误', error);
            return 0;
        }
    }

    /**
     * 获取 Set 的成员数量
     * @param key - 键名
     * @returns 成员数量
     */
    async scard(key: string): Promise<number> {
        try {
            const pkey = `${prefix}${key}`;
            return await this.client.scard(pkey);
        } catch (error: any) {
            Logger.error('Redis scard 错误', error);
            return 0;
        }
    }

    /**
     * 获取 Set 的所有成员
     * @param key - 键名
     * @returns 成员数组
     */
    async smembers(key: string): Promise<string[]> {
        try {
            const pkey = `${prefix}${key}`;
            return await this.client.smembers(pkey);
        } catch (error: any) {
            Logger.error('Redis smembers 错误', error);
            return [];
        }
    }

    /**
     * 删除键
     * @param key - 键名
     * @returns 删除的键数量
     */
    async del(key: string): Promise<number> {
        try {
            const pkey = `${prefix}${key}`;
            return await this.client.del(pkey);
        } catch (error: any) {
            Logger.error('Redis del 错误', error);
            return 0;
        }
    }

    /**
     * 测试 Redis 连接
     * @returns ping 响应结果
     */
    async ping(): Promise<string> {
        try {
            return await this.client.ping();
        } catch (error: any) {
            Logger.error('Redis ping 错误', error);
            throw error;
        }
    }
}
