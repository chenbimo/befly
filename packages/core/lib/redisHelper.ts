/**
 * Redis 助手 - TypeScript 版本
 * 提供 Redis 操作的便捷方法
 */

import { RedisClient } from "bun";

import { Connect } from "./connect";
import { Logger } from "./logger";

/**
 * Redis 助手类
 * 约定：除构造函数外，方法默认不抛异常；失败时返回 null/false/0/[] 并记录日志。
 */
export class RedisHelper {
    private client: RedisClient;
    private prefix: string;

    private readonly slowThresholdMs: number = 500;

    /**
     * 构造函数
     * @param prefix - Key 前缀
     */
    constructor(prefix: string = "") {
        const client = Connect.getRedis();
        if (!client) {
            throw new Error("Redis 客户端未初始化，请先调用 Connect.connectRedis()");
        }
        this.client = client;
        this.prefix = prefix ? `${prefix}:` : "";
    }

    private logSlow(cmd: string, key: string, duration: number, extra: Record<string, any> = {}): void {
        if (duration <= this.slowThresholdMs) return;
        Logger.warn(
            {
                subsystem: "redis",
                event: "slow",
                duration: duration,
                cmd: cmd,
                key: key,
                extra: extra
            },
            "🐌 Redis 慢操作"
        );
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

            const startTime = Date.now();

            if (ttl) {
                const res = await this.client.setex(pkey, ttl, data);
                const duration = Date.now() - startTime;
                this.logSlow("SETEX", pkey, duration, { ttl: ttl });
                return res;
            }

            const res = await this.client.set(pkey, data);
            const duration = Date.now() - startTime;
            this.logSlow("SET", pkey, duration);
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis setObject 错误");
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

            const startTime = Date.now();
            const data = await this.client.get(pkey);
            const duration = Date.now() - startTime;
            this.logSlow("GET", pkey, duration);
            return data ? JSON.parse(data) : null;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis getObject 错误");
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

            const startTime = Date.now();
            await this.client.del(pkey);
            const duration = Date.now() - startTime;
            this.logSlow("DEL", pkey, duration);
        } catch (error: any) {
            Logger.error({ err: error }, "Redis delObject 错误");
        }
    }

    // ==================== ID 生成 ====================
    // 注意：ID 生成功能强依赖 Redis 原子操作（INCR）保证分布式唯一性
    // 主要被 DbHelper.insData 使用

    /**
     * 生成基于时间的唯一 ID
     * 格式: 毫秒时间戳(13位) + 3位后缀(100-999) = 16位纯数字
     * 每毫秒起点基于时间戳偏移，后缀分布更均匀
     * @returns 唯一 ID (16位纯数字)
     */
    async genTimeID(): Promise<number> {
        const timestamp = Date.now();
        const key = `${this.prefix}time_id:${timestamp}`;

        const startTime = Date.now();

        const counter = await this.client.incr(key);
        if (counter === 1) {
            await this.client.expire(key, 1);
        }

        const duration = Date.now() - startTime;
        this.logSlow("INCR", key, duration, { expireSeconds: 1 });

        // 基于时间戳偏移起点，后缀 100-999 循环
        const suffix = 100 + (((timestamp % 900) + counter - 1) % 900);

        return Number(`${timestamp}${suffix}`);
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

            const startTime = Date.now();
            if (ttl) {
                const res = await this.client.setex(pkey, ttl, value);
                const duration = Date.now() - startTime;
                this.logSlow("SETEX", pkey, duration, { ttl: ttl });
                return res;
            }

            const res = await this.client.set(pkey, value);
            const duration = Date.now() - startTime;
            this.logSlow("SET", pkey, duration);
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis setString 错误");
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

            const startTime = Date.now();
            const res = await this.client.get(pkey);
            const duration = Date.now() - startTime;
            this.logSlow("GET", pkey, duration);
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis getString 错误");
            return null;
        }
    }

    /**
     * 检查键是否存在
     * @param key - 键名
     * @returns 是否存在（true/false）
     */
    async exists(key: string): Promise<boolean> {
        try {
            const pkey = `${this.prefix}${key}`;

            const startTime = Date.now();
            const res = await this.client.exists(pkey);
            const duration = Date.now() - startTime;
            this.logSlow("EXISTS", pkey, duration);
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis exists 错误");
            return false;
        }
    }

    /**
     * 原子自增
     * @param key - 键名
     * @returns 自增后的值
     */
    async incr(key: string): Promise<number> {
        try {
            const pkey = `${this.prefix}${key}`;

            const startTime = Date.now();
            const res = await this.client.incr(pkey);
            const duration = Date.now() - startTime;
            this.logSlow("INCR", pkey, duration);
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis incr 错误");
            return 0;
        }
    }

    /**
     * 原子自增并在首次自增时设置过期时间（常用于限流/计数）
     * @param key - 键名
     * @param seconds - 过期秒数
     * @returns 自增后的值
     */
    async incrWithExpire(key: string, seconds: number): Promise<number> {
        try {
            const pkey = `${this.prefix}${key}`;

            const startTime = Date.now();
            const res = await this.client.incr(pkey);
            if (res === 1) {
                await this.client.expire(pkey, seconds);
            }
            const duration = Date.now() - startTime;
            this.logSlow("INCR", pkey, duration, { expireSeconds: seconds });
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis incrWithExpire 错误");
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

            const startTime = Date.now();
            const res = await this.client.expire(pkey, seconds);
            const duration = Date.now() - startTime;
            this.logSlow("EXPIRE", pkey, duration, { seconds: seconds });
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis expire 错误");
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

            const startTime = Date.now();
            const res = await this.client.ttl(pkey);
            const duration = Date.now() - startTime;
            this.logSlow("TTL", pkey, duration);
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis ttl 错误");
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
            Logger.error({ err: error }, "Redis ttlBatch 错误");
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

            const startTime = Date.now();
            const res = await this.client.sadd(pkey, ...members);
            const duration = Date.now() - startTime;
            this.logSlow("SADD", pkey, duration, { membersCount: members.length });
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis sadd 错误");
            return 0;
        }
    }

    /**
     * 判断成员是否在 Set 中
     * @param key - 键名
     * @param member - 成员
     * @returns 是否存在（true/false）
     */
    async sismember(key: string, member: string): Promise<boolean> {
        try {
            const pkey = `${this.prefix}${key}`;

            const startTime = Date.now();
            const res = await this.client.sismember(pkey, member);
            const duration = Date.now() - startTime;
            this.logSlow("SISMEMBER", pkey, duration);
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis sismember 错误");
            return false;
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

            const startTime = Date.now();
            const res = await this.client.scard(pkey);
            const duration = Date.now() - startTime;
            this.logSlow("SCARD", pkey, duration);
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis scard 错误");
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

            const startTime = Date.now();
            const res = await this.client.smembers(pkey);
            const duration = Date.now() - startTime;
            this.logSlow("SMEMBERS", pkey, duration);
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis smembers 错误");
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
            Logger.error({ err: error }, "Redis saddBatch 错误");
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
            return await Promise.all(items.map((item) => this.sismember(item.key, item.member)));
        } catch (error: any) {
            Logger.error({ err: error }, "Redis sismemberBatch 错误");
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

            const startTime = Date.now();
            const res = await this.client.del(pkey);
            const duration = Date.now() - startTime;
            this.logSlow("DEL", pkey, duration);
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis del 错误");
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
            Logger.error({ err: error }, "Redis delBatch 错误");
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
            Logger.error({ err: error }, "Redis setBatch 错误");
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
            Logger.error({ err: error }, "Redis getBatch 错误");
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
            return await Promise.all(keys.map((key) => this.exists(key)));
        } catch (error: any) {
            Logger.error({ err: error }, "Redis existsBatch 错误");
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
            Logger.error({ err: error }, "Redis expireBatch 错误");
            return 0;
        }
    }

    /**
     * 测试 Redis 连接
     * @returns ping 响应结果
     */
    async ping(): Promise<string> {
        try {
            const startTime = Date.now();
            const res = await this.client.ping();
            const duration = Date.now() - startTime;
            this.logSlow("PING", "(no-key)", duration);
            return res;
        } catch (error: any) {
            Logger.error({ err: error }, "Redis ping 错误");
            throw error;
        }
    }
}
