/**
 * 日志系统 - Bun 环境自定义实现（替换 pino / pino-roll）
 */

import type { LoggerConfig } from "../types/logger";

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { hostname as osHostname } from "node:os";
import { isAbsolute as nodePathIsAbsolute, join as nodePathJoin, resolve as nodePathResolve } from "node:path";

import { formatYmdHms } from "../utils/formatYmdHms";
import { buildSensitiveKeyMatcher, sanitizeLogObject, shiftBatchFromPending } from "../utils/loggerUtils";
import { isPlainObject, normalizePositiveInt } from "../utils/util";
import { getCtx } from "./asyncContext";

// 注意：Logger 可能在运行时/测试中被 process.chdir() 影响。
// 为避免相对路径的 logs 目录随着 cwd 变化，使用模块加载时的初始 cwd 作为锚点。
const INITIAL_CWD = process.cwd();

const DEFAULT_LOG_STRING_LEN = 100;
const DEFAULT_LOG_ARRAY_ITEMS = 100;

// 为避免递归导致栈溢出/性能抖动：使用非递归遍历，并对深度/节点数做硬限制。
// 说明：这不是业务数据结构的“真实深度”，而是日志清洗的最大深入层级（越大越重）。
const DEFAULT_LOG_SANITIZE_DEPTH = 3;
const DEFAULT_LOG_OBJECT_KEYS = 100;
const DEFAULT_LOG_SANITIZE_NODES = 500;

const BUILTIN_SENSITIVE_KEYS = ["*password*", "pass", "pwd", "*token*", "access_token", "refresh_token", "accessToken", "refreshToken", "authorization", "cookie", "set-cookie", "*secret*", "apiKey", "api_key", "privateKey", "private_key"];

let sanitizeOptions = {
    maxStringLen: DEFAULT_LOG_STRING_LEN,
    maxArrayItems: DEFAULT_LOG_ARRAY_ITEMS,
    sanitizeDepth: DEFAULT_LOG_SANITIZE_DEPTH,
    sanitizeNodes: DEFAULT_LOG_SANITIZE_NODES,
    sanitizeObjectKeys: DEFAULT_LOG_OBJECT_KEYS,
    sensitiveKeyMatcher: buildSensitiveKeyMatcher({ builtinPatterns: BUILTIN_SENSITIVE_KEYS, userPatterns: [] })
};

type LogLevelName = "debug" | "info" | "warn" | "error";

type SinkLogger = {
    info(...args: any[]): any;
    warn(...args: any[]): any;
    error(...args: any[]): any;
    debug(...args: any[]): any;
};

const HOSTNAME = (() => {
    try {
        return osHostname();
    } catch {
        return "unknown";
    }
})();

const LOG_LEVEL_NUM: Record<LogLevelName, number> = {
    debug: 20,
    info: 30,
    warn: 40,
    error: 50
};

let instance: SinkLogger | null = null;
let errorInstance: SinkLogger | null = null;
let mockInstance: SinkLogger | null = null;

let appFileSink: LogFileSink | null = null;
let errorFileSink: LogFileSink | null = null;

let appConsoleSink: LogStreamSink | null = null;

const DEFAULT_CONFIG: LoggerConfig = {
    debug: 0,
    dir: "./logs",
    console: 1,
    maxSize: 20
};

let config: LoggerConfig = Object.assign({}, DEFAULT_CONFIG);

function normalizeLogLevelName(): LogLevelName {
    // 与旧行为保持一致：debug=1 -> debug，否则 -> info
    return config.debug === 1 ? "debug" : "info";
}

function shouldAccept(minLevel: LogLevelName, level: LogLevelName): boolean {
    return LOG_LEVEL_NUM[level] >= LOG_LEVEL_NUM[minLevel];
}

function safeWriteStderr(msg: string): void {
    try {
        process.stderr.write(`${msg}\n`);
    } catch {
        // ignore
    }
}

function scheduleDeferredFlush(currentTimer: NodeJS.Timeout | null, flushDelayMs: number, flush: () => Promise<void>): NodeJS.Timeout {
    if (currentTimer) return currentTimer;
    return setTimeout(() => {
        void flush();
    }, flushDelayMs);
}

type StreamKind = "stdout" | "stderr";

class LogStreamSink {
    private kind: StreamKind;
    private minLevel: LogLevelName;
    private pending: string[];
    private pendingBytes: number;
    private scheduledTimer: NodeJS.Timeout | null;
    private flushing: boolean;
    private maxBufferBytes: number;
    private flushDelayMs: number;
    private maxBatchBytes: number;

    public constructor(options: { kind: StreamKind; minLevel: LogLevelName }) {
        this.kind = options.kind;
        this.minLevel = options.minLevel;

        this.pending = [];
        this.pendingBytes = 0;
        this.scheduledTimer = null;
        this.flushing = false;

        this.maxBufferBytes = 10 * 1024 * 1024;
        this.flushDelayMs = 10;
        this.maxBatchBytes = 64 * 1024;
    }

    public enqueue(level: LogLevelName, line: string): void {
        if (!shouldAccept(this.minLevel, level)) return;

        const bytes = Buffer.byteLength(line);
        if (this.pendingBytes + bytes > this.maxBufferBytes) {
            // stream sink：优先丢 debug/info，保留 warn/error
            if (LOG_LEVEL_NUM[level] < LOG_LEVEL_NUM.warn) {
                return;
            }
        }

        this.pending.push(line);
        this.pendingBytes += bytes;
        this.scheduledTimer = scheduleDeferredFlush(this.scheduledTimer, this.flushDelayMs, () => this.flush());
    }

    public async flushNow(): Promise<void> {
        await this.flush();
    }

    public async shutdown(): Promise<void> {
        if (this.scheduledTimer) {
            clearTimeout(this.scheduledTimer);
            this.scheduledTimer = null;
        }
        await this.flush();
    }

    private getStream(): NodeJS.WritableStream {
        return this.kind === "stderr" ? process.stderr : process.stdout;
    }

    private async flush(): Promise<void> {
        if (this.flushing) return;
        this.scheduledTimer = null;
        this.flushing = true;

        try {
            const stream = this.getStream();

            while (this.pending.length > 0) {
                const batch = shiftBatchFromPending(this.pending, this.maxBatchBytes);
                const chunk = batch.chunk;
                const chunkBytes = Buffer.byteLength(chunk);
                this.pendingBytes = this.pendingBytes - chunkBytes;

                const ok = stream.write(chunk);
                if (!ok) {
                    await new Promise<void>((resolve) => {
                        (stream as any).once("drain", () => resolve());
                    });
                }
            }
        } catch (error: any) {
            safeWriteStderr(`[Logger] stream sink error: ${error?.message || error}`);
        } finally {
            this.flushing = false;
            if (this.pending.length > 0) {
                this.scheduledTimer = scheduleDeferredFlush(this.scheduledTimer, this.flushDelayMs, () => this.flush());
            }
        }
    }
}

class LogFileSink {
    private prefix: "app" | "error";
    private minLevel: LogLevelName;
    private maxFileBytes: number;

    private pending: string[];
    private pendingBytes: number;
    private scheduledTimer: NodeJS.Timeout | null;
    private flushing: boolean;

    private maxBufferBytes: number;
    private flushDelayMs: number;
    private maxBatchBytes: number;

    private stream: ReturnType<typeof createWriteStream> | null;
    private streamDate: string;
    private streamIndex: number;
    private streamSizeBytes: number;
    private disabled: boolean;

    public constructor(options: { prefix: "app" | "error"; minLevel: LogLevelName; maxFileBytes: number }) {
        this.prefix = options.prefix;
        this.minLevel = options.minLevel;
        this.maxFileBytes = options.maxFileBytes;

        this.pending = [];
        this.pendingBytes = 0;
        this.scheduledTimer = null;
        this.flushing = false;

        this.maxBufferBytes = 10 * 1024 * 1024;
        this.flushDelayMs = 10;
        this.maxBatchBytes = 64 * 1024;

        this.stream = null;
        this.streamDate = "";
        this.streamIndex = 0;
        this.streamSizeBytes = 0;
        this.disabled = false;
    }

    public enqueue(level: LogLevelName, line: string): void {
        if (this.disabled) return;
        if (!shouldAccept(this.minLevel, level)) return;

        const bytes = Buffer.byteLength(line);
        if (this.pendingBytes + bytes > this.maxBufferBytes) {
            // 文件 sink：优先丢 debug/info，保留 warn/error
            if (LOG_LEVEL_NUM[level] < LOG_LEVEL_NUM.warn) {
                return;
            }
        }

        this.pending.push(line);
        this.pendingBytes += bytes;
        this.scheduledTimer = scheduleDeferredFlush(this.scheduledTimer, this.flushDelayMs, () => this.flush());
    }

    public async flushNow(): Promise<void> {
        await this.flush();
    }

    public async shutdown(): Promise<void> {
        if (this.scheduledTimer) {
            clearTimeout(this.scheduledTimer);
            this.scheduledTimer = null;
        }
        await this.flush();
        await this.closeStream();
    }

    private async closeStream(): Promise<void> {
        if (!this.stream) return;
        const st = this.stream;
        this.stream = null;

        await new Promise<void>((resolve) => {
            try {
                st.end(() => resolve());
            } catch {
                resolve();
            }
        });
    }

    private getFilePath(date: string, index: number): string {
        const suffix = index > 0 ? `.${index}` : "";
        const filename = `${this.prefix}.${date}${suffix}.log`;
        return nodePathJoin(resolveLogDir(), filename);
    }

    private async ensureStreamReady(nextChunkBytes: number): Promise<void> {
        const date = formatYmdHms(new Date(), "date");

        // 日期变化：切新文件
        if (this.stream && this.streamDate && date !== this.streamDate) {
            await this.closeStream();
            this.streamDate = "";
            this.streamIndex = 0;
            this.streamSizeBytes = 0;
        }

        // 首次打开
        if (!this.stream) {
            const filePath = this.getFilePath(date, 0);
            let size = 0;
            try {
                const st = await stat(filePath);
                size = typeof st.size === "number" ? st.size : 0;
            } catch {
                size = 0;
            }

            this.streamDate = date;
            this.streamIndex = 0;
            this.streamSizeBytes = size;

            try {
                this.stream = createWriteStream(filePath, { flags: "a" });
                this.stream.on("error", (error: any) => {
                    safeWriteStderr(`[Logger] file sink error (${this.prefix}): ${error?.message || error}`);
                    this.disabled = true;
                    void this.closeStream();
                });
            } catch (error: any) {
                safeWriteStderr(`[Logger] createWriteStream failed (${this.prefix}): ${error?.message || error}`);
                this.disabled = true;
                return;
            }
        }

        // 大小滚动
        if (this.stream && this.maxFileBytes > 0 && this.streamSizeBytes + nextChunkBytes > this.maxFileBytes) {
            await this.closeStream();
            this.streamIndex = this.streamIndex + 1;
            const filePath = this.getFilePath(date, this.streamIndex);
            this.streamDate = date;
            this.streamSizeBytes = 0;
            try {
                this.stream = createWriteStream(filePath, { flags: "a" });
                this.stream.on("error", (error: any) => {
                    safeWriteStderr(`[Logger] file sink error (${this.prefix}): ${error?.message || error}`);
                    this.disabled = true;
                    void this.closeStream();
                });
            } catch (error: any) {
                safeWriteStderr(`[Logger] createWriteStream failed (${this.prefix}): ${error?.message || error}`);
                this.disabled = true;
                return;
            }
        }
    }

    private async flush(): Promise<void> {
        if (this.disabled) {
            this.pending = [];
            this.pendingBytes = 0;
            return;
        }
        if (this.flushing) return;
        this.scheduledTimer = null;
        this.flushing = true;

        try {
            while (this.pending.length > 0 && !this.disabled) {
                const batch = shiftBatchFromPending(this.pending, this.maxBatchBytes);
                const chunk = batch.chunk;
                const chunkBytes = Buffer.byteLength(chunk);
                this.pendingBytes = this.pendingBytes - chunkBytes;

                await this.ensureStreamReady(chunkBytes);
                if (!this.stream) {
                    // 文件 sink 已被禁用或打开失败
                    break;
                }

                const ok = this.stream.write(chunk);
                if (!ok) {
                    await new Promise<void>((resolve) => {
                        (this.stream as any).once("drain", () => resolve());
                    });
                }
                this.streamSizeBytes = this.streamSizeBytes + chunkBytes;
            }
        } catch (error: any) {
            safeWriteStderr(`[Logger] file sink flush error (${this.prefix}): ${error?.message || error}`);
        } finally {
            this.flushing = false;
            if (this.pending.length > 0 && !this.disabled) {
                this.scheduledTimer = scheduleDeferredFlush(this.scheduledTimer, this.flushDelayMs, () => this.flush());
            }
        }
    }
}

export async function flush(): Promise<void> {
    // 测试场景：mock logger 不需要 flush
    if (mockInstance) return;

    const sinks: Array<{ flush: () => Promise<void> }> = [];
    if (appFileSink) sinks.push({ flush: () => (appFileSink ? appFileSink.flushNow() : Promise.resolve()) });
    if (errorFileSink) sinks.push({ flush: () => (errorFileSink ? errorFileSink.flushNow() : Promise.resolve()) });
    if (appConsoleSink) sinks.push({ flush: () => (appConsoleSink ? appConsoleSink.flushNow() : Promise.resolve()) });

    for (const item of sinks) {
        try {
            await item.flush();
        } catch {
            // ignore
        }
    }
}

export async function shutdown(): Promise<void> {
    // 测试场景：mock logger 不需要 shutdown
    if (mockInstance) return;

    // 重要：shutdown 可能与后续 Logger.getLogger() 并发。
    // 因此这里捕获“当前的旧 sink/instance 快照”，只关闭这些快照，避免把新创建的 sink 一并清掉。
    const currentInstance = instance;
    const currentErrorInstance = errorInstance;
    const currentAppFileSink = appFileSink;
    const currentErrorFileSink = errorFileSink;
    const currentAppConsoleSink = appConsoleSink;

    const sinks: Array<{ shutdown: () => Promise<void> }> = [];
    if (currentAppFileSink) sinks.push({ shutdown: () => currentAppFileSink.shutdown() });
    if (currentErrorFileSink) sinks.push({ shutdown: () => currentErrorFileSink.shutdown() });
    if (currentAppConsoleSink) sinks.push({ shutdown: () => currentAppConsoleSink.shutdown() });

    for (const item of sinks) {
        try {
            await item.shutdown();
        } catch {
            // ignore
        }
    }

    if (appFileSink === currentAppFileSink) {
        appFileSink = null;
    }
    if (errorFileSink === currentErrorFileSink) {
        errorFileSink = null;
    }
    if (appConsoleSink === currentAppConsoleSink) {
        appConsoleSink = null;
    }

    if (instance === currentInstance) {
        instance = null;
    }
    if (errorInstance === currentErrorInstance) {
        errorInstance = null;
    }

    // shutdown 后允许下一次重新初始化时再次校验/创建目录（测试会清理目录，避免 ENOENT）
    // 无需缓存状态：确保目录存在是幂等的。
}

function resolveLogDir(): string {
    const rawDir = config.dir || "./logs";
    if (nodePathIsAbsolute(rawDir)) {
        return rawDir;
    }
    return nodePathResolve(INITIAL_CWD, rawDir);
}

function ensureLogDirExists(): void {
    const dir = resolveLogDir();
    try {
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    } catch (error: any) {
        // 不能在 Logger 初始化前调用 Logger 本身，直接抛错即可
        throw new Error(`创建 logs 目录失败: ${dir}. ${error?.message || error}`);
    }
}

// 方案B：删除“启动时清理旧日志”功能（减少 I/O 与复杂度）。

/**
 * 配置日志
 */
export function configure(cfg: LoggerConfig): void {
    // 旧实例可能仍持有文件句柄；这里异步关闭（不阻塞主流程）
    void shutdown();

    // 方案B：每次 configure 都从默认配置重新构建（避免继承上一次配置造成测试/运行时污染）
    config = Object.assign({}, DEFAULT_CONFIG, cfg);

    // maxSize：仅按 MB 计算，且强制范围 10..100
    {
        const raw = config.maxSize;
        let mb = typeof raw === "number" && Number.isFinite(raw) ? raw : 20;
        if (mb < 10) mb = 10;
        if (mb > 100) mb = 100;
        config.maxSize = mb;
    }

    instance = null;
    errorInstance = null;
    appFileSink = null;
    errorFileSink = null;
    appConsoleSink = null;

    // 运行时清洗/截断上限（可配置）
    sanitizeOptions = {
        maxStringLen: normalizePositiveInt(config.maxStringLen, DEFAULT_LOG_STRING_LEN, 20, 200000),
        maxArrayItems: normalizePositiveInt(config.maxArrayItems, DEFAULT_LOG_ARRAY_ITEMS, 10, 5000),
        sanitizeDepth: normalizePositiveInt(config.sanitizeDepth, DEFAULT_LOG_SANITIZE_DEPTH, 1, 10),
        sanitizeNodes: normalizePositiveInt(config.sanitizeNodes, DEFAULT_LOG_SANITIZE_NODES, 50, 20000),
        sanitizeObjectKeys: normalizePositiveInt(config.sanitizeObjectKeys, DEFAULT_LOG_OBJECT_KEYS, 10, 5000),
        sensitiveKeyMatcher: buildSensitiveKeyMatcher({ builtinPatterns: BUILTIN_SENSITIVE_KEYS, userPatterns: config.excludeFields })
    };
}

/**
 * 设置 Mock Logger（用于测试）
 * @param mock - Mock Logger 实例（形如 {info/warn/error/debug}），传 null 清除 mock
 */
export function setMockLogger(mock: SinkLogger | null): void {
    mockInstance = mock;
}

/**
 * 获取 Logger 实例（延迟初始化）
 */
export function getLogger(): SinkLogger {
    // 优先返回 mock 实例（用于测试）
    if (mockInstance) return mockInstance;

    if (instance) return instance;

    ensureLogDirExists();

    // 方案B：移除启动清理旧日志（减少 I/O 与复杂度）。

    const minLevel = normalizeLogLevelName();
    const maxSizeMb = typeof config.maxSize === "number" ? config.maxSize : 20;
    const maxFileBytes = Math.floor(maxSizeMb * 1024 * 1024);

    if (!appFileSink) {
        appFileSink = new LogFileSink({ prefix: "app", minLevel: minLevel, maxFileBytes: maxFileBytes });
    }
    if (config.console === 1 && !appConsoleSink) {
        appConsoleSink = new LogStreamSink({ kind: "stdout", minLevel: minLevel });
    }

    instance = createSinkLogger({ kind: "app", minLevel: minLevel, fileSink: appFileSink, consoleSink: config.console === 1 ? appConsoleSink : null });
    return instance;
}

function getErrorLogger(): SinkLogger {
    if (mockInstance) return mockInstance;
    if (errorInstance) return errorInstance;

    ensureLogDirExists();

    // 方案B：移除启动清理旧日志（减少 I/O 与复杂度）。

    const maxSizeMb = typeof config.maxSize === "number" ? config.maxSize : 20;
    const maxFileBytes = Math.floor(maxSizeMb * 1024 * 1024);
    if (!errorFileSink) {
        // error logger：固定 minLevel=error
        errorFileSink = new LogFileSink({ prefix: "error", minLevel: "error", maxFileBytes: maxFileBytes });
    }

    errorInstance = createSinkLogger({ kind: "error", minLevel: "error", fileSink: errorFileSink, consoleSink: null });
    return errorInstance;
}

function formatExtrasToMsg(extras: any[]): string {
    if (!extras || extras.length === 0) return "";

    const parts: string[] = [];
    for (const item of extras) {
        if (item === null) {
            parts.push("null");
            continue;
        }
        if (item === undefined) {
            parts.push("undefined");
            continue;
        }
        if (typeof item === "string") {
            parts.push(item);
            continue;
        }
        if (typeof item === "number" || typeof item === "boolean" || typeof item === "bigint") {
            parts.push(String(item));
            continue;
        }
        if (item instanceof Error) {
            parts.push(item.stack || item.message || item.name);
            continue;
        }
        if (isPlainObject(item) || Array.isArray(item)) {
            try {
                parts.push(JSON.stringify(item));
            } catch {
                parts.push("[Unserializable]");
            }
            continue;
        }
        try {
            parts.push(String(item));
        } catch {
            parts.push("[Unknown]");
        }
    }

    return parts.join(" ");
}

function truncateForLog(value: string): string {
    const maxLen = sanitizeOptions.maxStringLen;
    if (typeof value !== "string") return "";
    if (value.length <= maxLen) return value;
    return value.slice(0, maxLen);
}

function formatErrorForLog(err: Error): Record<string, any> {
    const out: Record<string, any> = {
        name: err.name || "Error",
        message: truncateForLog(err.message || "")
    };

    if (typeof err.stack === "string") {
        out.stack = truncateForLog(err.stack);
    }

    return out;
}

function buildLogLine(level: LogLevelName, args: any[]): string {
    const time = Date.now();
    const date = new Date(time);
    const base: Record<string, any> = {
        level: LOG_LEVEL_NUM[level],
        time: time,
        timeText: formatYmdHms(date),
        pid: process.pid,
        hostname: HOSTNAME
    };

    if (!args || args.length === 0) {
        base.msg = "";
        return `${JSON.stringify(base)}\n`;
    }

    const first = args[0];
    const second = args.length > 1 ? args[1] : undefined;

    // 兼容：logger.(level)(obj, msg?, ...)
    if (isPlainObject(first)) {
        for (const [k, v] of Object.entries(first as Record<string, any>)) {
            base[k] = v;
        }
        if (typeof second === "string") {
            const extraMsg = formatExtrasToMsg(args.slice(2));
            base.msg = extraMsg ? `${second} ${extraMsg}` : second;
        } else {
            const extraMsg = formatExtrasToMsg(args.slice(1));
            base.msg = extraMsg;
        }
        return `${safeJsonStringify(base)}\n`;
    }

    // 兼容：logger.(level)(err, msg?)
    if (first instanceof Error) {
        base.err = formatErrorForLog(first);
        if (typeof second === "string") {
            const extraMsg = formatExtrasToMsg(args.slice(2));
            base.msg = extraMsg ? `${second} ${extraMsg}` : second;
        } else {
            base.msg = formatExtrasToMsg(args.slice(1));
        }
        return `${safeJsonStringify(base)}\n`;
    }

    // 兼容：logger.(level)(msg, ...)
    if (typeof first === "string") {
        const extraMsg = formatExtrasToMsg(args.slice(1));
        base.msg = extraMsg ? `${first} ${extraMsg}` : first;
        return `${safeJsonStringify(base)}\n`;
    }

    // 兜底
    base.msg = formatExtrasToMsg(args);
    return `${safeJsonStringify(base)}\n`;
}

function safeJsonStringify(obj: Record<string, any>): string {
    try {
        return JSON.stringify(obj);
    } catch {
        try {
            return JSON.stringify({ level: obj.level, time: obj.time, pid: obj.pid, hostname: obj.hostname, msg: "[Unserializable log record]" });
        } catch {
            return '{"msg":"[Unserializable log record]"}';
        }
    }
}

function createSinkLogger(options: { kind: "app" | "slow" | "error"; minLevel: LogLevelName; fileSink: LogFileSink; consoleSink: LogStreamSink | null }): SinkLogger {
    const minLevel = options.minLevel;

    const write = (level: LogLevelName, args: any[]) => {
        if (!shouldAccept(minLevel, level)) return;

        const line = buildLogLine(level, args);
        options.fileSink.enqueue(level, line);
        if (options.consoleSink) {
            options.consoleSink.enqueue(level, line);
        }

        // 关键级别日志应尽快落盘/输出，避免进程快速退出时“只有 exit code，看不到日志”。
        // 注意：flushNow 内部有 flushing/scheduled 防重入，且会吞掉 I/O 异常，因此这里 fire-and-forget。
        if (LOG_LEVEL_NUM[level] >= LOG_LEVEL_NUM.warn) {
            void options.fileSink.flushNow();
            if (options.consoleSink) {
                void options.consoleSink.flushNow();
            }
        }
    };

    return {
        info(...args: any[]) {
            write("info", args);
        },
        warn(...args: any[]) {
            write("warn", args);
        },
        error(...args: any[]) {
            write("error", args);
        },
        debug(...args: any[]) {
            write("debug", args);
        }
    };
}

// 对象清洗/脱敏/截断逻辑已下沉到 utils/loggerUtils.ts（减少 logger.ts 复杂度）。

function metaToObject(): Record<string, any> | null {
    const meta = getCtx();
    if (!meta) return null;

    const durationSinceNowMs = Date.now() - meta.now;

    const obj: Record<string, any> = {
        requestId: meta.requestId,
        method: meta.method,
        route: meta.route,
        ip: meta.ip,
        now: meta.now,
        durationSinceNowMs: durationSinceNowMs
    };

    // userId / roleCode 默认写入
    obj.userId = meta.userId;
    obj.roleCode = meta.roleCode;
    obj.nickname = (meta as any).nickname;
    obj.roleType = (meta as any).roleType;

    return obj;
}

function mergeMetaIntoObject(input: Record<string, any>, meta: Record<string, any>): Record<string, any> {
    const merged: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
        merged[key] = value;
    }

    // 只补齐、不覆盖：允许把 undefined / null / 空字符串写入（由日志底层序列化决定是否展示）
    const keys = ["requestId", "method", "route", "ip", "now", "durationSinceNowMs", "userId", "roleCode", "nickname", "roleType"];

    for (const key of keys) {
        if (merged[key] === undefined) merged[key] = meta[key];
    }

    return merged;
}

function withRequestMeta(args: any[]): any[] {
    const meta = metaToObject();
    if (!meta) return args;
    if (args.length === 0) return args;

    const first = args[0];
    const second = args.length > 1 ? args[1] : undefined;

    // 兼容：Logger.error("xxx", err)
    if (typeof first === "string" && second instanceof Error) {
        const obj = {
            err: second
        };
        const merged = mergeMetaIntoObject(obj, meta);
        return [merged, first, ...args.slice(2)];
    }

    // pino 原生：logger.error(err, msg)
    if (first instanceof Error) {
        const msg = typeof second === "string" ? second : undefined;
        const obj = {
            err: first
        };
        const merged = mergeMetaIntoObject(obj, meta);
        if (msg) return [merged, msg, ...args.slice(2)];
        return [merged, ...args.slice(1)];
    }

    // 纯字符串：Logger.info("msg") -> logger.info(meta, "msg")
    if (typeof first === "string") {
        return [meta, ...args];
    }

    // 对象：Logger.info(obj, msg?) -> 合并 meta（不覆盖显式字段）
    if (isPlainObject(first)) {
        const merged = mergeMetaIntoObject(first as Record<string, any>, meta);
        return [merged, ...args.slice(1)];
    }

    return args;
}

type LoggerObject = Record<string, any>;

// 兼容 pino 常用调用形式 + 本项目的 Logger.error("msg", err)
type LoggerCallArgs = [] | [msg: string, ...args: unknown[]] | [obj: LoggerObject, msg?: string, ...args: unknown[]] | [err: Error, msg?: string, ...args: unknown[]] | [msg: string, err: Error, ...args: unknown[]];

function withRequestMetaTyped(args: LoggerCallArgs): LoggerCallArgs {
    // 复用现有逻辑（保持行为一致），只收敛类型
    return withRequestMeta(args as any[]) as unknown as LoggerCallArgs;
}

/**
 * 日志实例（延迟初始化）
 */
export const Logger = {
    info(...args: LoggerCallArgs) {
        if (args.length === 0) return;
        const logger = getLogger();
        const finalArgs = withRequestMetaTyped(args);
        if (finalArgs.length === 0) return;
        if (finalArgs.length > 0 && isPlainObject(finalArgs[0])) {
            finalArgs[0] = sanitizeLogObject(finalArgs[0] as Record<string, any>, sanitizeOptions);
        }
        const ret = (logger.info as any).apply(logger, finalArgs);
        return ret;
    },
    warn(...args: LoggerCallArgs) {
        if (args.length === 0) return;
        const logger = getLogger();
        const finalArgs = withRequestMetaTyped(args);
        if (finalArgs.length === 0) return;
        if (finalArgs.length > 0 && isPlainObject(finalArgs[0])) {
            finalArgs[0] = sanitizeLogObject(finalArgs[0] as Record<string, any>, sanitizeOptions);
        }
        const ret = (logger.warn as any).apply(logger, finalArgs);
        return ret;
    },
    error(...args: LoggerCallArgs) {
        if (args.length === 0) return;
        const logger = getLogger();
        const finalArgs = withRequestMetaTyped(args);
        if (finalArgs.length === 0) return;
        if (finalArgs.length > 0 && isPlainObject(finalArgs[0])) {
            finalArgs[0] = sanitizeLogObject(finalArgs[0] as Record<string, any>, sanitizeOptions);
        }
        const ret = (logger.error as any).apply(logger, finalArgs);

        // 测试场景：启用 mock 时不做镜像，避免调用次数翻倍
        if (mockInstance) return ret;

        // error 专属文件：始终镜像一份
        const errorLogger = getErrorLogger();
        (errorLogger.error as any).apply(errorLogger, finalArgs);

        return ret;
    },
    debug(...args: LoggerCallArgs) {
        if (args.length === 0) return;
        const logger = getLogger();
        const finalArgs = withRequestMetaTyped(args);
        if (finalArgs.length === 0) return;
        if (finalArgs.length > 0 && isPlainObject(finalArgs[0])) {
            finalArgs[0] = sanitizeLogObject(finalArgs[0] as Record<string, any>, sanitizeOptions);
        }
        const ret = (logger.debug as any).apply(logger, finalArgs);
        return ret;
    },
    async flush() {
        await flush();
    },
    configure: configure,
    setMock: setMockLogger,
    shutdown: shutdown
};
