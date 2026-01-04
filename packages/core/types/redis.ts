/**
 * Redis 助手类型定义
 */

import type { BeflyContext } from "./befly.ts";
import type { RedisClient } from "bun";

/**
 * Redis Key 类型
 */
export type RedisKey = string;

/**
 * Redis Value 类型
 */
export type RedisValue = string | number | boolean | object | null;

/**
 * Redis 配置选项
 */
export interface RedisOptions {
    host: string;
    port: number;
    password?: string;
    db?: number;
    prefix?: string;
}

/**
 * Redis 助手接口
 */
export interface RedisHelper {
    /** Redis 客户端实例 */
    client: RedisClient;

    /**
     * 设置值
     */
    set(key: RedisKey, value: RedisValue, ttl?: number): Promise<boolean>;

    /**
     * 获取值
     */
    get<T = RedisValue>(key: RedisKey): Promise<T | null>;

    /**
     * 删除键
     */
    del(key: RedisKey | RedisKey[]): Promise<number>;

    /**
     * 检查键是否存在
     */
    exists(key: RedisKey): Promise<boolean>;

    /**
     * 设置过期时间
     */
    expire(key: RedisKey, ttl: number): Promise<boolean>;

    /**
     * 获取剩余生存时间
     */
    ttl(key: RedisKey): Promise<number>;

    /**
     * 获取所有匹配的键
     */
    keys(pattern: string): Promise<RedisKey[]>;

    /**
     * 哈希表设置字段
     */
    hset(key: RedisKey, field: string, value: RedisValue): Promise<number>;

    /**
     * 哈希表获取字段
     */
    hget<T = RedisValue>(key: RedisKey, field: string): Promise<T | null>;

    /**
     * 哈希表删除字段
     */
    hdel(key: RedisKey, field: string | string[]): Promise<number>;

    /**
     * 哈希表获取所有字段和值
     */
    hgetall<T = RedisValue>(key: RedisKey): Promise<Record<string, T>>;

    /**
     * 列表左侧推入
     */
    lpush(key: RedisKey, value: RedisValue): Promise<number>;

    /**
     * 列表右侧推入
     */
    rpush(key: RedisKey, value: RedisValue): Promise<number>;

    /**
     * 列表左侧弹出
     */
    lpop<T = RedisValue>(key: RedisKey): Promise<T | null>;

    /**
     * 列表右侧弹出
     */
    rpop<T = RedisValue>(key: RedisKey): Promise<T | null>;

    /**
     * 获取列表范围
     */
    lrange<T = RedisValue>(key: RedisKey, start: number, stop: number): Promise<T[]>;
}

/**
 * RedisHelper 构造函数类型
 */
export interface RedisHelperConstructor {
    new (befly: BeflyContext, options?: RedisOptions): RedisHelper;
}
