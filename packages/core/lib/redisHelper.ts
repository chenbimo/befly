/**
 * Redis 助手 - TypeScript 版本
 * 提供 Redis 操作的便捷方法
 */

import { SQL, RedisClient } from 'bun';
import { Logger } from './logger.js';
import { Connect } from './connect.js';
import type { KeyValue } from 'befly-shared/types';

/**
 * Redis 助手类
 */
export class RedisHelper {
    private client: RedisClient;
    private prefix: string;

    /**
     * 构造函数
     * @param prefix - Key 前缀
     */
    constructor(prefix: string = '') {
        const client = Connect.getRedis();
        if (!client) {
            throw new Error('Redis 客户端未初始化，请先调用 Connect.connectRedis()');
        }
        this.client = client;
        this.prefix = prefix ? `${prefix}:` : '';
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
            const pkey = `${this.prefix}${key}`;

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
            const pkey = `${this.prefix}${key}`;
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
            const pkey = `${this.prefix}${key}`;
            await this.client.del(pkey);
        } catch (error: any) {
            Logger.error('Redis delObject 错误', error);
        }
    }

    // ==================== ID 生成 ====================
    // 注意：ID 生成功能强依赖 Redis 原子操作（INCR/INCRBY）保证分布式唯一性
    // 主要被 DbHelper.insData 使用

    /**
     * 生成基于时间的唯一 ID
     * 格式: 毫秒时间戳(13位) + 3位后缀(500-999) = 16位纯数字
     * @returns 唯一 ID (16位纯数字)
     */
    async genTimeID(): Promise<number> {
        const ids = await this.genTimeIDBatch(1);
        return ids[0];
    }

    /**
     * 批量生成基于时间的唯一 ID
     * 格式: 毫秒时间戳(13位) + 3位后缀(500-999) = 16位纯数字
     * 使用 INCRBY 一次性获取连续计数器，效率更高
     * @param count - 需要生成的 ID 数量
     * @returns 唯一 ID 数组 (16位纯数字)
     */
    async genTimeIDBatch(count: number): Promise<number[]> {
        if (count <= 0) return [];

        const timestamp = Date.now();
        const key = `${this.prefix}time_id_counter:${timestamp}`;

        // 一次性获取 count 个连续计数器
        const endCounter = await this.client.incrby(key, count);
        await this.client.expire(key, 1);

        // 生成 ID 数组
        const ids: number[] = [];
        const startCounter = endCounter - count + 1;

        for (let i = 0; i < count; i++) {
            const counter = startCounter + i;
            // 使用 500-999 范围，保证后缀不以小数字开头
            const base = 500 + (counter % 500);
            const suffix = base.toString().padStart(3, '0');
            ids.push(Number(`${timestamp}${suffix}`));
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
            const pkey = `${this.prefix}${key}`;
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
            const pkey = `${this.prefix}${key}`;
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
            const pkey = `${this.prefix}${key}`;
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
            const pkey = `${this.prefix}${key}`;
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
            const pkey = `${this.prefix}${key}`;
            return await this.client.ttl(pkey);
        } catch (error: any) {
            Logger.error('Redis ttl 错误', error);
            return -1;
        }
    }

    /**
     * 批量获取剩余过期时间（利用 Bun Redis 自动管道优化）
     * @param keys - 键名数组
     * @returns TTL 数组（-2 表示键不存在，-1 表示无过期时间）
     */
    async ttlBatch(keys: string[]): Promise<number[]> {
        if (keys.length === 0) {
            return [];
        }

        try {
            const results = await Promise.all(keys.map((key) => this.ttl(key)));
            return results;
        } catch (error: any) {
            Logger.error('Redis ttlBatch 错误', error);
            return keys.map(() => -1);
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

            const pkey = `${this.prefix}${key}`;
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
            const pkey = `${this.prefix}${key}`;
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
            const pkey = `${this.prefix}${key}`;
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
            const pkey = `${this.prefix}${key}`;
            return await this.client.smembers(pkey);
        } catch (error: any) {
            Logger.error('Redis smembers 错误', error);
            return [];
        }
    }

    /**
     * 批量向多个 Set 添加成员（利用 Bun Redis 自动管道优化）
     * @param items - [{ key, members }] 数组
     * @returns 成功添加的总成员数量
     */
    async saddBatch(items: Array<{ key: string; members: string[] }>): Promise<number> {
        if (items.length === 0) {
            return 0;
        }

        try {
            const results = await Promise.all(items.map((item) => this.sadd(item.key, item.members)));
            return results.reduce((sum, count) => sum + count, 0);
        } catch (error: any) {
            Logger.error('Redis saddBatch 错误', error);
            return 0;
        }
    }

    /**
     * 批量检查成员是否在 Set 中（利用 Bun Redis 自动管道优化）
     * @param items - [{ key, member }] 数组
     * @returns 布尔数组（true 表示存在，false 表示不存在）
     */
    async sismemberBatch(items: Array<{ key: string; member: string }>): Promise<boolean[]> {
        if (items.length === 0) {
            return [];
        }

        try {
            const results = await Promise.all(items.map((item) => this.sismember(item.key, item.member)));
            return results.map((r) => r > 0);
        } catch (error: any) {
            Logger.error('Redis sismemberBatch 错误', error);
            return items.map(() => false);
        }
    }

    /**
     * 删除键
     * @param key - 键名
     * @returns 删除的键数量
     */
    async del(key: string): Promise<number> {
        try {
            const pkey = `${this.prefix}${key}`;
            return await this.client.del(pkey);
        } catch (error: any) {
            Logger.error('Redis del 错误', error);
            return 0;
        }
    }

    /**
     * 批量删除键（利用 Bun Redis 自动管道优化）
     * @param keys - 键名数组
     * @returns 成功删除的键数量
     */
    async delBatch(keys: string[]): Promise<number> {
        if (keys.length === 0) {
            return 0;
        }

        try {
            const results = await Promise.all(
                keys.map((key) => {
                    const pkey = `${this.prefix}${key}`;
                    return this.client.del(pkey);
                })
            );
            return results.reduce((sum, count) => sum + count, 0);
        } catch (error: any) {
            Logger.error('Redis delBatch 错误', error);
            return 0;
        }
    }

    /**
     * 批量设置对象（利用 Bun Redis 自动管道优化）
     * @param items - 键值对数组 [{ key, value, ttl? }]
     * @returns 成功设置的数量
     */
    async setBatch<T = any>(items: Array<{ key: string; value: T; ttl?: number | null }>): Promise<number> {
        if (items.length === 0) {
            return 0;
        }

        try {
            const results = await Promise.all(items.map((item) => this.setObject(item.key, item.value, item.ttl ?? null)));
            return results.filter((r) => r !== null).length;
        } catch (error: any) {
            Logger.error('Redis setBatch 错误', error);
            return 0;
        }
    }

    /**
     * 批量获取对象（利用 Bun Redis 自动管道优化）
     * @param keys - 键名数组
     * @returns 对象数组（不存在的键返回 null）
     */
    async getBatch<T = any>(keys: string[]): Promise<Array<T | null>> {
        if (keys.length === 0) {
            return [];
        }

        try {
            const results = await Promise.all(keys.map((key) => this.getObject<T>(key)));
            return results;
        } catch (error: any) {
            Logger.error('Redis getBatch 错误', error);
            return keys.map(() => null);
        }
    }

    /**
     * 批量检查键是否存在（利用 Bun Redis 自动管道优化）
     * @param keys - 键名数组
     * @returns 布尔数组（true 表示存在，false 表示不存在）
     */
    async existsBatch(keys: string[]): Promise<boolean[]> {
        if (keys.length === 0) {
            return [];
        }

        try {
            const results = await Promise.all(keys.map((key) => this.exists(key)));
            return results.map((r) => r > 0);
        } catch (error: any) {
            Logger.error('Redis existsBatch 错误', error);
            return keys.map(() => false);
        }
    }

    /**
     * 批量设置过期时间（利用 Bun Redis 自动管道优化）
     * @param items - 键名和过期时间数组 [{ key, seconds }]
     * @returns 成功设置的数量
     */
    async expireBatch(items: Array<{ key: string; seconds: number }>): Promise<number> {
        if (items.length === 0) {
            return 0;
        }

        try {
            const results = await Promise.all(items.map((item) => this.expire(item.key, item.seconds)));
            return results.filter((r) => r > 0).length;
        } catch (error: any) {
            Logger.error('Redis expireBatch 错误', error);
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
