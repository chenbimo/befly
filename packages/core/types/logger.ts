/**
 * 日志相关类型定义
 *
 * 说明：这里的类型需要与 core/runtime 的 logger 实现保持一致（大量配置项以 0/1 表示开关）。
 */

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

    /** 单文件大小（MB） */
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

/**
 * Logger 接口（类型层）。
 *
 * 说明：core/runtime 内部使用的是 Bun 环境的自定义 Logger 实现（异步批量写入）。
 * 对外只承诺常用的 `info/warn/error/debug` 等调用形式（兼容常见 pino 调用风格）。
 */
export interface Logger {
    info(...args: any[]): any;
    warn(...args: any[]): any;
    error(...args: any[]): any;
    debug(...args: any[]): any;

    configure(cfg: LoggerConfig): void;
    setMock(mock: any | null): void;

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
