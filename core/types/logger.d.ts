/**
 * 日志相关类型定义
 */

/**
 * 日志级别
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'trace';

/**
 * 日志消息
 */
export type LogMessage = string | Record<string, any>;

/**
 * 日志选项
 */
export interface LogOptions {
    /** 日志级别 */
    level?: LogLevel;
    /** 是否输出到控制台 */
    console?: boolean;
    /** 是否写入文件 */
    file?: boolean;
    /** 日志文件路径 */
    filePath?: string;
    /** 敏感字段列表 */
    sensitiveFields?: string[];
}

/**
 * 日志记录器接口
 */
export interface Logger {
    /** 记录信息日志 */
    info(message: LogMessage): void;
    /** 记录警告日志 */
    warn(message: LogMessage): void;
    /** 记录错误日志 */
    error(message: LogMessage): void;
    /** 记录调试日志 */
    debug(message: LogMessage): void;
}
