/**
 * Redis 相关类型定义
 */

import { RedisClient as BunRedisClient } from 'bun';

/**
 * Redis 客户端类型
 */
export type RedisClient = BunRedisClient;

/**
 * Redis 键前缀
 */
export type RedisKeyPrefix = string;

/**
 * Redis TTL（秒）
 */
export type RedisTTL = number | null;

/**
 * Redis 助手接口
 */
export interface RedisHelper {
    // ==================== 基础操作 ====================
    /** 设置对象到 Redis */
    setObject<T = any>(key: string, obj: T, ttl?: RedisTTL): Promise<string | null>;
    /** 从 Redis 获取对象 */
    getObject<T = any>(key: string): Promise<T | null>;
    /** 从 Redis 删除对象 */
    delObject(key: string): Promise<void>;
    /** 设置字符串值 */
    setString(key: string, value: string, ttl?: RedisTTL): Promise<string | null>;
    /** 获取字符串值 */
    getString(key: string): Promise<string | null>;
    /** 检查键是否存在 */
    exists(key: string): Promise<number>;
    /** 设置过期时间 */
    expire(key: string, seconds: number): Promise<number>;
    /** 获取剩余过期时间 */
    ttl(key: string): Promise<number>;
    /** 删除键 */
    del(key: string): Promise<number>;
    /** 测试 Redis 连接 */
    ping(): Promise<string>;

    // ==================== ID 生成 ====================
    /** 生成基于时间的唯一 ID (16位纯数字: 13位毫秒时间戳 + 3位后缀100-999) */
    genTimeID(): Promise<number>;

    // ==================== Set 操作 ====================
    /** 向 Set 中添加一个或多个成员 */
    sadd(key: string, members: string[]): Promise<number>;
    /** 判断成员是否在 Set 中 */
    sismember(key: string, member: string): Promise<number>;
    /** 获取 Set 的成员数量 */
    scard(key: string): Promise<number>;
    /** 获取 Set 的所有成员 */
    smembers(key: string): Promise<string[]>;

    // ==================== 批量操作 ====================
    /** 批量设置对象 */
    setBatch<T = any>(items: Array<{ key: string; value: T; ttl?: number | null }>): Promise<number>;
    /** 批量获取对象 */
    getBatch<T = any>(keys: string[]): Promise<Array<T | null>>;
    /** 批量删除键 */
    delBatch(keys: string[]): Promise<number>;
    /** 批量检查键是否存在 */
    existsBatch(keys: string[]): Promise<boolean[]>;
    /** 批量设置过期时间 */
    expireBatch(items: Array<{ key: string; seconds: number }>): Promise<number>;
    /** 批量获取剩余过期时间 */
    ttlBatch(keys: string[]): Promise<number[]>;
    /** 批量向多个 Set 添加成员 */
    saddBatch(items: Array<{ key: string; members: string[] }>): Promise<number>;
    /** 批量检查成员是否在 Set 中 */
    sismemberBatch(items: Array<{ key: string; member: string }>): Promise<boolean[]>;
}
