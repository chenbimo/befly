/**
 * 日志系统 - Bun 环境自定义实现（替换 pino / pino-roll）
 */

import type { LoggerConfig } from "../types/logger";

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { readdir, stat, unlink } from "node:fs/promises";
import { hostname as osHostname } from "node:os";
import { isAbsolute as nodePathIsAbsolute, join as nodePathJoin, resolve as nodePathResolve } from "node:path";

import { isPlainObject } from "../utils/util";
import { getCtx } from "./asyncContext";

const REGEXP_SPECIAL = /[\\^$.*+?()[\]{}|]/g;

export function escapeRegExp(input: string): string {
    return String(input).replace(REGEXP_SPECIAL, "\\$&");
}

// 注意：Logger 可能在运行时/测试中被 process.chdir() 影响。
// 为避免相对路径的 logs 目录随着 cwd 变化，使用模块加载时的初始 cwd 作为锚点。
const INITIAL_CWD = process.cwd();

const DEFAULT_LOG_STRING_LEN = 100;
const DEFAULT_LOG_ARRAY_ITEMS = 100;

let maxLogStringLen = DEFAULT_LOG_STRING_LEN;
let maxLogArrayItems = DEFAULT_LOG_ARRAY_ITEMS;

// 为避免递归导致栈溢出/性能抖动：使用非递归遍历，并对深度/节点数做硬限制。
// 说明：这不是业务数据结构的“真实深度”，而是日志清洗的最大深入层级（越大越重）。
const DEFAULT_LOG_SANITIZE_DEPTH = 3;
const DEFAULT_LOG_OBJECT_KEYS = 100;
const DEFAULT_LOG_SANITIZE_NODES = 500;

let sanitizeDepthLimit = DEFAULT_LOG_SANITIZE_DEPTH;
let sanitizeObjectKeysLimit = DEFAULT_LOG_OBJECT_KEYS;
let sanitizeNodesLimit = DEFAULT_LOG_SANITIZE_NODES;

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const BUILTIN_SENSITIVE_KEYS = ["*password*", "pass", "pwd", "*token*", "access_token", "refresh_token", "accessToken", "refreshToken", "authorization", "cookie", "set-cookie", "*secret*", "apiKey", "api_key", "privateKey", "private_key"];

let sensitiveKeySet: Set<string> = new Set();
let sensitiveContainsMatchers: string[] = [];
let sensitiveContainsRegex: RegExp | null = null;

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

const DEFAULT_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const DEFAULT_FLUSH_DELAY_MS = 10;
const DEFAULT_MAX_BATCH_BYTES = 64 * 1024;

let instance: SinkLogger | null = null;
let errorInstance: SinkLogger | null = null;
let mockInstance: SinkLogger | null = null;

let appFileSink: LogFileSink | null = null;
let errorFileSink: LogFileSink | null = null;

let appConsoleSink: LogStreamSink | null = null;

let didWarnIoError: boolean = false;
let didPruneOldLogFiles: boolean = false;
let didEnsureLogDir: boolean = false;
let didInstallGracefulExitHooks: boolean = false;
let config: LoggerConfig = {
    debug: 0,
    dir: "./logs",
    console: 1,
    maxSize: 10
};

function installGracefulExitHooks(): void {
    if (didInstallGracefulExitHooks) return;
    didInstallGracefulExitHooks = true;

    const install = (signal: "SIGINT" | "SIGTERM", exitCode: number): void => {
        // 若业务侧已经注册了 handler，避免我们抢占默认行为
        try {
            if (typeof process.listenerCount === "function" && process.listenerCount(signal) > 0) {
                return;
            }
        } catch {
            // ignore
        }

        try {
            process.once(signal, () => {
                let exited = false;

                // 给 flush 一个机会；超过上限则强制退出
                const timer = setTimeout(() => {
                    if (exited) return;
                    exited = true;
                    try {
                        process.exit(exitCode);
                    } catch {
                        // ignore
                    }
                }, 2000);

                void shutdown()
                    .catch(() => undefined)
                    .finally(() => {
                        if (exited) return;
                        exited = true;
                        clearTimeout(timer);
                        try {
                            process.exit(exitCode);
                        } catch {
                            // ignore
                        }
                    });
            });
        } catch {
            // ignore
        }
    };

    install("SIGINT", 130);
    install("SIGTERM", 143);
}

function formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const mm = m < 10 ? `0${m}` : String(m);
    const dd = d < 10 ? `0${d}` : String(d);
    return `${y}-${mm}-${dd}`;
}

function normalizeLogLevelName(): LogLevelName {
    // 与旧行为保持一致：debug=1 -> debug，否则 -> info
    return config.debug === 1 ? "debug" : "info";
}

function shouldAccept(minLevel: LogLevelName, level: LogLevelName): boolean {
    return LOG_LEVEL_NUM[level] >= LOG_LEVEL_NUM[minLevel];
}

function safeWriteStderrOnce(msg: string): void {
    if (didWarnIoError) return;
    didWarnIoError = true;
    try {
        process.stderr.write(`${msg}\n`);
    } catch {
        // ignore
    }
}

type StreamKind = "stdout" | "stderr";

function shiftBatchFromPending(pending: string[], maxBatchBytes: number): { chunk: string; bytes: number } {
    const parts: string[] = [];
    let bytes = 0;

    while (pending.length > 0) {
        const next = pending[0] as string;
        const nextBytes = Buffer.byteLength(next);
        if (parts.length > 0 && bytes + nextBytes > maxBatchBytes) {
            break;
        }
        parts.push(next);
        bytes += nextBytes;
        pending.shift();
    }

    return { chunk: parts.join(""), bytes: bytes };
}

class LogStreamSink {
    private kind: StreamKind;
    private minLevel: LogLevelName;
    private pending: string[];
    private pendingBytes: number;
    private scheduled: boolean;
    private flushing: boolean;
    private maxBufferBytes: number;
    private flushDelayMs: number;
    private maxBatchBytes: number;

    public constructor(options: { kind: StreamKind; minLevel: LogLevelName }) {
        this.kind = options.kind;
        this.minLevel = options.minLevel;

        this.pending = [];
        this.pendingBytes = 0;
        this.scheduled = false;
        this.flushing = false;

        this.maxBufferBytes = DEFAULT_MAX_BUFFER_BYTES;
        this.flushDelayMs = DEFAULT_FLUSH_DELAY_MS;
        this.maxBatchBytes = DEFAULT_MAX_BATCH_BYTES;
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
        this.scheduleFlush();
    }

    public async flushNow(): Promise<void> {
        await this.flush();
    }

    public async shutdown(): Promise<void> {
        await this.flush();
    }

    private scheduleFlush(): void {
        if (this.scheduled) return;
        this.scheduled = true;
        setTimeout(() => {
            void this.flush();
        }, this.flushDelayMs);
    }

    private getStream(): NodeJS.WritableStream {
        return this.kind === "stderr" ? process.stderr : process.stdout;
    }

    private async flush(): Promise<void> {
        if (this.flushing) return;
        this.scheduled = false;
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
            safeWriteStderrOnce(`[Logger] stream sink error: ${error?.message || error}`);
        } finally {
            this.flushing = false;
            if (this.pending.length > 0) {
                this.scheduleFlush();
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
    private scheduled: boolean;
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
        this.scheduled = false;
        this.flushing = false;

        this.maxBufferBytes = DEFAULT_MAX_BUFFER_BYTES;
        this.flushDelayMs = DEFAULT_FLUSH_DELAY_MS;
        this.maxBatchBytes = DEFAULT_MAX_BATCH_BYTES;

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
        this.scheduleFlush();
    }

    public async flushNow(): Promise<void> {
        await this.flush();
    }

    public async shutdown(): Promise<void> {
        await this.flush();
        await this.closeStream();
    }

    private scheduleFlush(): void {
        if (this.scheduled) return;
        this.scheduled = true;
        setTimeout(() => {
            void this.flush();
        }, this.flushDelayMs);
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
        const date = formatLocalDate(new Date());

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
                    safeWriteStderrOnce(`[Logger] file sink error (${this.prefix}): ${error?.message || error}`);
                    this.disabled = true;
                    void this.closeStream();
                });
            } catch (error: any) {
                safeWriteStderrOnce(`[Logger] createWriteStream failed (${this.prefix}): ${error?.message || error}`);
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
                    safeWriteStderrOnce(`[Logger] file sink error (${this.prefix}): ${error?.message || error}`);
                    this.disabled = true;
                    void this.closeStream();
                });
            } catch (error: any) {
                safeWriteStderrOnce(`[Logger] createWriteStream failed (${this.prefix}): ${error?.message || error}`);
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
        this.scheduled = false;
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
            safeWriteStderrOnce(`[Logger] file sink flush error (${this.prefix}): ${error?.message || error}`);
        } finally {
            this.flushing = false;
            if (this.pending.length > 0 && !this.disabled) {
                this.scheduleFlush();
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

    const sinks: Array<{ shutdown: () => Promise<void> }> = [];
    if (appFileSink) sinks.push({ shutdown: () => (appFileSink ? appFileSink.shutdown() : Promise.resolve()) });
    if (errorFileSink) sinks.push({ shutdown: () => (errorFileSink ? errorFileSink.shutdown() : Promise.resolve()) });
    if (appConsoleSink) sinks.push({ shutdown: () => (appConsoleSink ? appConsoleSink.shutdown() : Promise.resolve()) });

    for (const item of sinks) {
        try {
            await item.shutdown();
        } catch {
            // ignore
        }
    }

    appFileSink = null;
    errorFileSink = null;
    appConsoleSink = null;

    instance = null;
    errorInstance = null;
}

function normalizePositiveInt(value: any, fallback: number, min: number, max: number): number {
    if (typeof value !== "number") return fallback;
    if (!Number.isFinite(value)) return fallback;
    const v = Math.floor(value);
    if (v < min) return fallback;
    if (v > max) return max;
    return v;
}

function resolveLogDir(): string {
    const rawDir = config.dir || "./logs";
    if (nodePathIsAbsolute(rawDir)) {
        return rawDir;
    }
    return nodePathResolve(INITIAL_CWD, rawDir);
}

function ensureLogDirExists(): void {
    if (didEnsureLogDir) return;
    didEnsureLogDir = true;

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

async function pruneOldLogFiles(): Promise<void> {
    if (didPruneOldLogFiles) return;
    didPruneOldLogFiles = true;

    const dir = resolveLogDir();
    const now = Date.now();
    const cutoff = now - ONE_YEAR_MS;

    try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile()) continue;

            const name = entry.name;

            // 只处理本项目的日志文件前缀
            const isTarget = name.startsWith("app.") || name.startsWith("error.");
            if (!isTarget) continue;

            const fullPath = nodePathJoin(dir, name);

            let st: any;
            try {
                st = await stat(fullPath);
            } catch {
                continue;
            }

            const mtimeMs = typeof st.mtimeMs === "number" ? st.mtimeMs : 0;
            if (mtimeMs > 0 && mtimeMs < cutoff) {
                try {
                    await unlink(fullPath);
                } catch {
                    // 忽略删除失败（权限/占用等），避免影响服务启动
                }
            }
        }
    } catch {
        // 忽略：目录不存在或无权限等
    }
}

/**
 * 配置日志
 */
export function configure(cfg: LoggerConfig): void {
    // 旧实例可能仍持有文件句柄；这里异步关闭（不阻塞主流程）
    void shutdown();

    config = Object.assign({}, config, cfg);
    instance = null;
    errorInstance = null;
    didPruneOldLogFiles = false;
    didEnsureLogDir = false;
    didWarnIoError = false;
    appFileSink = null;
    errorFileSink = null;
    appConsoleSink = null;

    // 运行时清洗上限（可配置）
    sanitizeDepthLimit = normalizePositiveInt(config.sanitizeDepth, DEFAULT_LOG_SANITIZE_DEPTH, 1, 10);
    sanitizeNodesLimit = normalizePositiveInt(config.sanitizeNodes, DEFAULT_LOG_SANITIZE_NODES, 50, 20000);
    sanitizeObjectKeysLimit = normalizePositiveInt(config.sanitizeObjectKeys, DEFAULT_LOG_OBJECT_KEYS, 10, 5000);

    // 运行时截断上限（可配置）
    maxLogStringLen = normalizePositiveInt(config.maxStringLen, DEFAULT_LOG_STRING_LEN, 20, 200000);
    maxLogArrayItems = normalizePositiveInt(config.maxArrayItems, DEFAULT_LOG_ARRAY_ITEMS, 10, 5000);

    // 仅支持数组配置：excludeFields?: string[]
    const userPatterns = Array.isArray(config.excludeFields) ? config.excludeFields : [];
    const patterns: string[] = [];
    for (const item of BUILTIN_SENSITIVE_KEYS) {
        const trimmed = String(item).trim();
        if (trimmed.length > 0) patterns.push(trimmed.toLowerCase());
    }
    for (const item of userPatterns) {
        const trimmed = String(item).trim();
        if (trimmed.length > 0) patterns.push(trimmed.toLowerCase());
    }

    const exactSet = new Set<string>();
    const containsMatchers: string[] = [];

    for (const pat of patterns) {
        // 精简策略：
        // - 无 *：精确匹配
        // - 有 *：统一按“包含匹配”处理（*x*、x*、*x、a*b 都视为包含 core）
        if (!pat.includes("*")) {
            exactSet.add(pat);
            continue;
        }

        const core = pat.replace(/\*+/g, "").trim();
        if (!core) {
            continue;
        }
        containsMatchers.push(core);
    }

    sensitiveKeySet = exactSet;
    sensitiveContainsMatchers = containsMatchers;

    // 预编译包含匹配：减少每次 isSensitiveKey 的循环开销
    // 注意：patterns 已全部 lowerCase，因此 regex 不需要 i 标志
    if (containsMatchers.length > 0) {
        const escaped = containsMatchers.map((item) => escapeRegExp(item)).filter((item) => item.length > 0);
        if (escaped.length > 0) {
            sensitiveContainsRegex = new RegExp(escaped.join("|"));
        } else {
            sensitiveContainsRegex = null;
        }
    } else {
        sensitiveContainsRegex = null;
    }
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
    installGracefulExitHooks();

    // 启动时清理过期日志（异步，不阻塞初始化）
    void pruneOldLogFiles();

    const minLevel = normalizeLogLevelName();
    const maxFileBytes = (typeof config.maxSize === "number" && config.maxSize > 0 ? config.maxSize : 10) * 1024 * 1024;

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
    installGracefulExitHooks();

    void pruneOldLogFiles();

    const maxFileBytes = (typeof config.maxSize === "number" && config.maxSize > 0 ? config.maxSize : 10) * 1024 * 1024;
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

function buildLogLine(level: LogLevelName, args: any[]): string {
    const time = Date.now();
    const base: Record<string, any> = {
        level: LOG_LEVEL_NUM[level],
        time: time,
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
        base.err = sanitizeErrorValue(first, {});
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

function truncateString(val: string, stats: Record<string, number>): string {
    if (val.length <= maxLogStringLen) return val;
    return val.slice(0, maxLogStringLen);
}

function isSensitiveKey(key: string): boolean {
    const lower = String(key).toLowerCase();
    if (sensitiveKeySet.has(lower)) return true;

    if (sensitiveContainsRegex) {
        return sensitiveContainsRegex.test(lower);
    }

    for (const part of sensitiveContainsMatchers) {
        if (lower.includes(part)) return true;
    }

    return false;
}

function safeToStringMasked(val: any, visited: WeakSet<object>, stats: Record<string, number>): string {
    if (typeof val === "string") return val;

    if (val instanceof Error) {
        const name = val.name || "Error";
        const message = val.message || "";
        const stack = typeof val.stack === "string" ? val.stack : "";
        const errObj: Record<string, any> = {
            name: name,
            message: message,
            stack: stack
        };
        try {
            return JSON.stringify(errObj);
        } catch {
            return `${name}: ${message}`;
        }
    }

    if (val && typeof val === "object") {
        if (visited.has(val as object)) {
            return "[Circular]";
        }
    }

    try {
        const localVisited = visited;
        const replacer = (k: string, v: any) => {
            // JSON.stringify 的根节点 key 为空字符串
            if (k && isSensitiveKey(k)) {
                return "[MASKED]";
            }

            if (v && typeof v === "object") {
                if (localVisited.has(v as object)) {
                    return "[Circular]";
                }
                localVisited.add(v as object);
            }
            return v;
        };
        return JSON.stringify(val, replacer);
    } catch {
        try {
            return String(val);
        } catch {
            return "[Unserializable]";
        }
    }
}

function sanitizeErrorValue(err: Error, stats: Record<string, number>): Record<string, any> {
    const errObj: Record<string, any> = {
        name: err.name || "Error",
        message: truncateString(err.message || "", stats)
    };
    if (typeof err.stack === "string") {
        errObj.stack = truncateString(err.stack, stats);
    }
    return errObj;
}

function stringifyPreview(val: any, visited: WeakSet<object>, stats: Record<string, number>): string {
    const str = safeToStringMasked(val, visited, stats);
    return truncateString(str, stats);
}

function sanitizeValueLimited(val: any, visited: WeakSet<object>, stats: Record<string, number>): any {
    if (val === null || val === undefined) return val;
    if (typeof val === "string") return truncateString(val, stats);
    if (typeof val === "number") return val;
    if (typeof val === "boolean") return val;
    if (typeof val === "bigint") return val;

    if (val instanceof Error) {
        return sanitizeErrorValue(val, stats);
    }

    // 仅支持数组 + plain object 的结构化清洗，其余类型走字符串预览。
    const isArr = Array.isArray(val);
    const isObj = isPlainObject(val);
    if (!isArr && !isObj) {
        return stringifyPreview(val, visited, stats);
    }

    // 防环（根节点）
    if (visited.has(val as object)) {
        return "[Circular]";
    }
    visited.add(val as object);

    const rootOut: any = isArr ? [] : {};

    type Frame = { src: any; dst: any; depth: number };
    const stack: Frame[] = [{ src: val, dst: rootOut, depth: 1 }];

    let nodes = 0;

    const tryAssign = (dst: any, key: string | number, child: any, depth: number) => {
        if (child === null || child === undefined) {
            dst[key] = child;
            return;
        }
        if (typeof child === "string") {
            dst[key] = truncateString(child, stats);
            return;
        }
        if (typeof child === "number" || typeof child === "boolean" || typeof child === "bigint") {
            dst[key] = child;
            return;
        }
        if (child instanceof Error) {
            dst[key] = sanitizeErrorValue(child, stats);
            return;
        }

        const childIsArr = Array.isArray(child);
        const childIsObj = isPlainObject(child);

        if (!childIsArr && !childIsObj) {
            dst[key] = stringifyPreview(child, visited, stats);
            return;
        }

        // 深度/节点数上限：超出则降级为字符串预览
        if (depth >= sanitizeDepthLimit) {
            dst[key] = stringifyPreview(child, visited, stats);
            return;
        }
        if (nodes >= sanitizeNodesLimit) {
            dst[key] = stringifyPreview(child, visited, stats);
            return;
        }

        // 防环
        if (visited.has(child as object)) {
            dst[key] = "[Circular]";
            return;
        }
        visited.add(child as object);

        const childOut: any = childIsArr ? [] : {};
        dst[key] = childOut;
        stack.push({ src: child, dst: childOut, depth: depth + 1 });
    };

    while (stack.length > 0) {
        const frame = stack.pop() as Frame;
        nodes = nodes + 1;
        if (nodes > sanitizeNodesLimit) {
            // 超出节点上限：不再深入（已入栈的节点会被忽略，留空结构由上层兜底预览）。
            break;
        }

        if (Array.isArray(frame.src)) {
            const arr = frame.src as any[];
            const len = arr.length;
            const limit = len > maxLogArrayItems ? maxLogArrayItems : len;

            for (let i = 0; i < limit; i++) {
                tryAssign(frame.dst, i, arr[i], frame.depth);
            }

            if (len > maxLogArrayItems) {
                // ignore omitted items
            }

            continue;
        }

        if (isPlainObject(frame.src)) {
            const entries = Object.entries(frame.src as Record<string, any>);
            const len = entries.length;
            const limit = len > sanitizeObjectKeysLimit ? sanitizeObjectKeysLimit : len;

            for (let i = 0; i < limit; i++) {
                const key = entries[i][0];
                const child = entries[i][1];
                if (isSensitiveKey(key)) {
                    frame.dst[key] = "[MASKED]";
                    continue;
                }
                tryAssign(frame.dst, key, child, frame.depth);
            }

            if (len > sanitizeObjectKeysLimit) {
                // ignore omitted keys
            }

            continue;
        }

        // 兜底：理论上不会到这里（frame 只会压入 array/plain object）
    }

    return rootOut;
}

function sanitizeTopValue(val: any, visited: WeakSet<object>): any {
    return sanitizeValueLimited(val, visited, {});
}

function sanitizeLogObject(obj: Record<string, any>): Record<string, any> {
    const visited = new WeakSet<object>();

    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
        if (isSensitiveKey(key)) {
            out[key] = "[MASKED]";
            continue;
        }
        out[key] = sanitizeTopValue(val, visited);
    }

    return out;
}

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
            finalArgs[0] = sanitizeLogObject(finalArgs[0] as Record<string, any>);
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
            finalArgs[0] = sanitizeLogObject(finalArgs[0] as Record<string, any>);
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
            finalArgs[0] = sanitizeLogObject(finalArgs[0] as Record<string, any>);
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
            finalArgs[0] = sanitizeLogObject(finalArgs[0] as Record<string, any>);
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
