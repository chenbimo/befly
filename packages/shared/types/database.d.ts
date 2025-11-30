/**
 * 数据库相关类型定义
 */

/**
 * SQL 值类型
 */
export type SqlValue = string | number | boolean | null | Date;

/**
 * SQL 参数数组类型
 */
export type SqlParams = SqlValue[];

/**
 * 排序方向
 */
export type OrderDirection = 'ASC' | 'DESC' | 'asc' | 'desc';

/**
 * 数据库类型
 */
export type DatabaseType = 'mysql' | 'postgresql' | 'sqlite';

/**
 * 数据库配置类型
 */
export interface DatabaseConfig {
    /** 数据库类型 */
    type: DatabaseType;
    /** 主机地址 */
    host: string;
    /** 端口号 */
    port: number;
    /** 用户名 */
    user: string;
    /** 密码 */
    password: string;
    /** 数据库名 */
    database: string;
}

/**
 * Redis 配置类型
 */
export interface RedisConfig {
    /** 主机地址 */
    host: string;
    /** 端口号 */
    port: number;
    /** 密码 */
    password?: string;
    /** 数据库索引 */
    db?: number;
}
