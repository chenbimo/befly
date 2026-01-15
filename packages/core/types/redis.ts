/**
 * Redis 助手类型定义
 */

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
    // ===== object helpers =====
    setObject<T = any>(key: string, obj: T, ttl?: number | null): Promise<string | null>;
    getObject<T = any>(key: string): Promise<T | null>;
    delObject(key: string): Promise<void>;

    // ===== id generator (used by DbHelper) =====
    genTimeID(): Promise<number>;

    // ===== string helpers =====
    setString(key: string, value: string, ttl?: number | null): Promise<string | null>;
    getString(key: string): Promise<string | null>;

    // ===== basic key ops =====
    exists(key: string): Promise<boolean>;
    incr(key: string): Promise<number>;
    incrWithExpire(key: string, seconds: number): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
    ttlBatch(keys: string[]): Promise<number[]>;

    // ===== set ops =====
    sadd(key: string, members: string[]): Promise<number>;
    sismember(key: string, member: string): Promise<boolean>;
    scard(key: string): Promise<number>;
    smembers(key: string): Promise<string[]>;
    saddBatch(items: Array<{ key: string; members: string[] }>): Promise<number>;
    sismemberBatch(items: Array<{ key: string; member: string }>): Promise<boolean[]>;

    // ===== batch ops =====
    del(key: string): Promise<number>;
    delBatch(keys: string[]): Promise<number>;
    setBatch<T = any>(items: Array<{ key: string; value: T; ttl?: number | null }>): Promise<number>;
    getBatch<T = any>(keys: string[]): Promise<Array<T | null>>;
    existsBatch(keys: string[]): Promise<boolean[]>;
    expireBatch(items: Array<{ key: string; seconds: number }>): Promise<number>;

    // ===== misc =====
    ping(): Promise<string>;
}

/**
 * RedisHelper 构造函数类型
 */
export interface RedisHelperConstructor {
    new (prefix?: string): RedisHelper;
}
