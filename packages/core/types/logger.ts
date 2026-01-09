/**
 * 日志相关类型定义
 *
 * 说明：这里的类型需要与 core/runtime 的 logger 实现保持一致（大量配置项以 0/1 表示开关）。
 */

import type { JsonValue } from "./common";

export type LoggerFlag = 0 | 1;

/**
 * Logger 插件配置
 */
export interface LoggerConfig {
    /** 是否开启 debug 输出（0/1） */
    debug?: LoggerFlag;

    /** 日志目录（相对路径会以初始化 cwd 为锚点解析） */
    dir?: string;

    /** 是否输出到控制台（0/1） */
    console?: LoggerFlag;

    /** 单文件最大大小（MB），例如 10 表示 10MB；默认 20MB */
    maxSize?: number;

    /** 日志清洗深度限制（1..10） */
    sanitizeDepth?: number;

    /** 日志清洗节点数限制（50..20000） */
    sanitizeNodes?: number;

    /** 日志对象 key 数量限制（10..5000） */
    sanitizeObjectKeys?: number;

    /** 单条字符串最大长度（20..200000） */
    maxStringLen?: number;

    /** 数组最大展开元素数（10..5000） */
    maxArrayItems?: number;

    /**
     * 自定义脱敏字段匹配（支持通配，如 *password*）
     */
    excludeFields?: string[];
}

export type LogLevelName = "debug" | "info" | "warn" | "error";

/**
 * LoggerRecord 允许出现的值类型。
 * - JsonValue：可序列化数据
 * - Error：允许直接传入错误对象（运行时会清洗成可序列化结构）
 * - object：允许传入非 plain object（如 Date/Map/Set/自定义 class 实例），由运行时做安全预览/截断
 */
export type LoggerRecordValue = JsonValue | Error | object;

export type LoggerRecord = {
    /** 文本消息（推荐直接放在 record 里） */
    msg?: string;
    /** 错误对象（会在运行时被清洗为可序列化结构） */
    err?: Error | JsonValue;
    /** 其他自定义字段 */
    [key: string]: LoggerRecordValue | undefined;
};

/**
 * Logger 的可替换 sink（用于测试 mock）。
 */
export interface LoggerSink {
    info(record: LoggerRecord): void;
    warn(record: LoggerRecord): void;
    error(record: LoggerRecord): void;
    debug(record: LoggerRecord): void;
}

/**
 * Logger 接口（类型层）。
 *
 * 说明：core/runtime 内部使用的是 Bun 环境的自定义 Logger 实现（异步批量写入）。
 * 对外只承诺常用的 `info/warn/error/debug` 等调用形式（不再兼容 pino 的多签名调用）。
 */
export interface Logger {
    /**
     * 只接受一个参数（任意类型）：
     * - plain object（{}）会作为 record 写入
     * - 其他任何类型会被包装成对象后写入（例如 { msg: "..." } 或 { value: ... }）
     */
    info(input: unknown): void;

    warn(input: unknown): void;

    error(input: unknown): void;

    debug(input: unknown): void;

    configure(cfg: LoggerConfig): void;
    setMock(mock: LoggerSink | null): void;

    /**
     * 将当前 buffer 尽快刷入 sink（不会关闭文件句柄）。
     *
     * 说明：主要用于测试或进程即将退出前的“尽快落盘”。
     */
    flush(): Promise<void>;

    /**
     * 刷新并关闭 sink（会关闭文件句柄）。
     *
     * 说明：主要用于测试（避免 Windows 句柄占用导致的删除/轮转失败）。
     */
    shutdown(): Promise<void>;
}
