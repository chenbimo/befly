/**
 * 日志相关类型定义
 */

/**
 * 日志级别
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/**
 * 日志配置
 */
export interface LoggerConfig {
    /** 是否开启调试模式 (0: 关闭, 1: 开启) @default 0 */
    debug?: number;
    /** 需要在日志中脱敏/排除的字段（逗号分隔）例如: 'password,token,secret' */
    excludeFields?: string;
    /** 日志目录 @default './logs' */
    dir?: string;
    /** 是否输出到控制台 (0: 关闭, 1: 开启) @default 1 */
    console?: number;
    /** 单个日志文件最大大小 (MB) @default 10 */
    maxSize?: number;
}
