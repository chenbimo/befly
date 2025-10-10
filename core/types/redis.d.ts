/**
 * Redis 相关类型定义
 */

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
    /** 设置对象到 Redis */
    setObject<T = any>(key: string, obj: T, ttl?: RedisTTL): Promise<string | null>;
    /** 从 Redis 获取对象 */
    getObject<T = any>(key: string): Promise<T | null>;
    /** 从 Redis 删除对象 */
    delObject(key: string): Promise<void>;
    /** 生成基于时间的唯一 ID */
    genTimeID(): Promise<number>;
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
}
