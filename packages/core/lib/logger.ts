/**
 * 日志系统 - Bun 环境自定义实现（替换 pino / pino-roll）
 */

import type { LoggerConfig } from "../types/logger";

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { hostname as osHostname } from "node:os";
import { isAbsolute as nodePathIsAbsolute, join as nodePathJoin, resolve as nodePathResolve } from "node:path";

import { formatYmdHms } from "../utils/formatYmdHms";
import { buildSensitiveKeyMatcher, sanitizeLogObject } from "../utils/loggerUtils";
import { isPlainObject, normalizePositiveInt } from "../utils/util";
import { getCtx } from "./asyncContext";

// 注意：Logger 可能在运行时/测试中被 process.chdir() 影响。
// 为避免相对路径的 logs 目录随着 cwd 变化，使用模块加载时的初始 cwd 作为锚点。
const INITIAL_CWD = process.cwd();

const BUILTIN_SENSITIVE_KEYS = ["*password*", "pass", "pwd", "*token*", "access_token", "refresh_token", "accessToken", "refreshToken", "authorization", "cookie", "set-cookie", "*secret*", "apiKey", "api_key", "privateKey", "private_key"];

let sanitizeOptions = {
    maxStringLen: 100,
    maxArrayItems: 100,
    sanitizeDepth: 3,
    sanitizeNodes: 500,
    sanitizeObjectKeys: 100,
    sensitiveKeyMatcher: buildSensitiveKeyMatcher({ builtinPatterns: BUILTIN_SENSITIVE_KEYS, userPatterns: [] })
};

type LogLevelName = "debug" | "info" | "warn" | "error";

type LoggerRecord = {
    msg?: string;
    event?: string;
    err?: unknown;
    [key: string]: any;
};

type SinkLogger = {
    info(record: unknown): any;
    warn(record: unknown): any;
    error(record: unknown): any;
    debug(record: unknown): any;
};

type StreamSink = {
    enqueue(line: string): void;
    flushNow(): Promise<void>;
    shutdown(): Promise<void>;
};

const HOSTNAME = (() => {
    try {
        return osHostname();
    } catch {
        return "unknown";
    }
})();

let instance: SinkLogger | null = null;
let errorInstance: SinkLogger | null = null;
let mockInstance: SinkLogger | null = null;

let appFileSink: LogFileSink | null = null;
let errorFileSink: LogFileSink | null = null;

let appConsoleSink: StreamSink | null = null;

let config: LoggerConfig = {
    debug: 0,
    dir: "./logs",
    console: 1,
    maxSize: 20
};

function safeWriteStderr(msg: string): void {
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
        bytes = bytes + nextBytes;
        pending.shift();
    }

    return { chunk: parts.join(""), bytes: bytes };
}

class BufferedSink {
    private pending: string[];
    private pendingBytes: number;
    private scheduledTimer: NodeJS.Timeout | null;
    private flushing: boolean;

    private maxBufferBytes: number;
    private flushDelayMs: number;
    private maxBatchBytes: number;

    private writeChunk: (chunk: string, chunkBytes: number) => Promise<boolean>;
    private onShutdown: (() => Promise<void>) | null;

    public constructor(options: { maxBufferBytes: number; flushDelayMs: number; maxBatchBytes: number; writeChunk: (chunk: string, chunkBytes: number) => Promise<boolean>; onShutdown?: (() => Promise<void>) | null }) {
        this.pending = [];
        this.pendingBytes = 0;
        this.scheduledTimer = null;
        this.flushing = false;

        this.maxBufferBytes = options.maxBufferBytes;
        this.flushDelayMs = options.flushDelayMs;
        this.maxBatchBytes = options.maxBatchBytes;

        this.writeChunk = options.writeChunk;
        this.onShutdown = options.onShutdown ? options.onShutdown : null;
    }

    private scheduleFlush(): void {
        if (this.scheduledTimer) return;

        this.scheduledTimer = setTimeout(() => {
            // timer 触发时先清空句柄，避免 flush 内再次 schedule 时被认为“已安排”。
            this.scheduledTimer = null;
            void this.flush();
        }, this.flushDelayMs);
    }

    private cancelScheduledFlush(): void {
        if (!this.scheduledTimer) return;
        clearTimeout(this.scheduledTimer);
        this.scheduledTimer = null;
    }

    public enqueue(line: string): void {
        const bytes = Buffer.byteLength(line);
        if (this.pendingBytes + bytes > this.maxBufferBytes) {
            // buffer 满：统一丢弃新日志（不区分 level）
            return;
        }

        this.pending.push(line);
        this.pendingBytes = this.pendingBytes + bytes;

        this.scheduleFlush();
    }

    public async flushNow(): Promise<void> {
        // 若已安排了定时 flush，flushNow 会覆盖它，避免出现多个 timer 并存。
        this.cancelScheduledFlush();
        await this.flush();
    }

    public async shutdown(): Promise<void> {
        this.cancelScheduledFlush();
        await this.flush();
        if (this.onShutdown) {
            await this.onShutdown();
        }
    }

    private async flush(): Promise<void> {
        if (this.flushing) return;
        this.flushing = true;

        try {
            while (this.pending.length > 0) {
                const batch = shiftBatchFromPending(this.pending, this.maxBatchBytes);
                const chunk = batch.chunk;
                const chunkBytes = Buffer.byteLength(chunk);
                this.pendingBytes = this.pendingBytes - chunkBytes;

                const ok = await this.writeChunk(chunk, chunkBytes);
                if (!ok) {
                    // writer 已禁用/失败：清空剩余 pending
                    this.pending = [];
                    this.pendingBytes = 0;
                    break;
                }
            }
        } finally {
            this.flushing = false;
            if (this.pending.length > 0) {
                this.scheduleFlush();
            }
        }
    }
}

function createStreamSink(kind: StreamKind): StreamSink {
    const getStream = () => {
        return kind === "stderr" ? process.stderr : process.stdout;
    };

    const buffer = new BufferedSink({
        maxBufferBytes: 10 * 1024 * 1024,
        flushDelayMs: 10,
        maxBatchBytes: 64 * 1024,
        writeChunk: async (chunk: string) => {
            try {
                const stream = getStream();
                const ok = stream.write(chunk);
                if (!ok) {
                    await new Promise<void>((resolve) => {
                        (stream as any).once("drain", () => resolve());
                    });
                }
                return true;
            } catch (error: any) {
                safeWriteStderr(`[Logger] stream sink error: ${error?.message || error}`);
                return false;
            }
        }
    });

    return {
        enqueue(line: string) {
            buffer.enqueue(line);
        },
        async flushNow() {
            await buffer.flushNow();
        },
        async shutdown() {
            await buffer.shutdown();
        }
    };
}

class LogFileSink {
    private prefix: "app" | "error";
    private maxFileBytes: number;

    private buffer: BufferedSink;

    private stream: ReturnType<typeof createWriteStream> | null;
    private streamDate: string;
    private streamIndex: number;
    private streamSizeBytes: number;
    private disabled: boolean;

    public constructor(options: { prefix: "app" | "error"; maxFileBytes: number }) {
        this.prefix = options.prefix;
        this.maxFileBytes = options.maxFileBytes;

        this.stream = null;
        this.streamDate = "";
        this.streamIndex = 0;
        this.streamSizeBytes = 0;
        this.disabled = false;

        this.buffer = new BufferedSink({
            maxBufferBytes: 10 * 1024 * 1024,
            flushDelayMs: 10,
            maxBatchBytes: 64 * 1024,
            writeChunk: async (chunk: string, chunkBytes: number) => {
                if (this.disabled) return false;

                try {
                    await this.ensureStreamReady(chunkBytes);
                    if (!this.stream) {
                        // 文件 sink 已被禁用或打开失败
                        return false;
                    }

                    const ok = this.stream.write(chunk);
                    if (!ok) {
                        await new Promise<void>((resolve) => {
                            (this.stream as any).once("drain", () => resolve());
                        });
                    }
                    this.streamSizeBytes = this.streamSizeBytes + chunkBytes;
                    return true;
                } catch (error: any) {
                    safeWriteStderr(`[Logger] file sink flush error (${this.prefix}): ${error?.message || error}`);
                    this.disabled = true;
                    await this.closeStream();
                    return false;
                }
            },
            onShutdown: async () => {
                await this.closeStream();
            }
        });
    }

    public enqueue(line: string): void {
        if (this.disabled) return;

        this.buffer.enqueue(line);
    }

    public async flushNow(): Promise<void> {
        await this.buffer.flushNow();
    }

    public async shutdown(): Promise<void> {
        await this.buffer.shutdown();
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

    private openStream(filePath: string): void {
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
            this.stream = null;
        }
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

            this.openStream(filePath);
            if (!this.stream) return;
        }

        // 大小滚动
        if (this.stream && this.maxFileBytes > 0 && this.streamSizeBytes + nextChunkBytes > this.maxFileBytes) {
            await this.closeStream();
            this.streamIndex = this.streamIndex + 1;
            const filePath = this.getFilePath(date, this.streamIndex);
            this.streamDate = date;
            this.streamSizeBytes = 0;

            this.openStream(filePath);
            if (!this.stream) return;
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
    config = Object.assign(
        {
            debug: 0,
            dir: "./logs",
            console: 1,
            maxSize: 20
        },
        cfg
    );

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
        maxStringLen: normalizePositiveInt(config.maxStringLen, 100, 20, 200000),
        maxArrayItems: normalizePositiveInt(config.maxArrayItems, 100, 10, 5000),
        sanitizeDepth: normalizePositiveInt(config.sanitizeDepth, 3, 1, 10),
        sanitizeNodes: normalizePositiveInt(config.sanitizeNodes, 500, 50, 20000),
        sanitizeObjectKeys: normalizePositiveInt(config.sanitizeObjectKeys, 100, 10, 5000),
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

function getSink(kind: "app" | "error"): SinkLogger {
    // 优先返回 mock 实例（用于测试）
    if (mockInstance) return mockInstance;

    if (kind === "app") {
        if (instance) return instance;
    } else {
        if (errorInstance) return errorInstance;
    }

    ensureLogDirExists();

    const maxSizeMb = typeof config.maxSize === "number" ? config.maxSize : 20;
    const maxFileBytes = Math.floor(maxSizeMb * 1024 * 1024);

    if (kind === "app") {
        if (!appFileSink) {
            appFileSink = new LogFileSink({ prefix: "app", maxFileBytes: maxFileBytes });
        }
        if (config.console === 1 && !appConsoleSink) {
            appConsoleSink = createStreamSink("stdout");
        }

        instance = createSinkLogger({ fileSink: appFileSink, consoleSink: config.console === 1 ? appConsoleSink : null });
        return instance;
    }

    if (!errorFileSink) {
        errorFileSink = new LogFileSink({ prefix: "error", maxFileBytes: maxFileBytes });
    }

    errorInstance = createSinkLogger({ fileSink: errorFileSink, consoleSink: null });
    return errorInstance;
}

/**
 * 获取 Logger 实例（延迟初始化）
 */
export function getLogger(): SinkLogger {
    return getSink("app");
}

function buildLogLine(level: LogLevelName, record: LoggerRecord): string {
    const time = Date.now();
    const base: Record<string, any> = {
        level: level,
        time: time,
        timeFormat: formatYmdHms(new Date(time)),
        pid: process.pid,
        hostname: HOSTNAME
    };

    // record 先写入，再用 base 覆盖基础字段（避免 record 覆盖 level/time/pid/hostname 等）
    // msg 允许保留 record.msg（若存在），否则补齐空字符串。
    if (record && isPlainObject(record)) {
        const out = Object.assign({}, record, base);
        if ((record as any).msg !== undefined) {
            out.msg = (record as any).msg;
        } else if (out.msg === undefined) {
            out.msg = "";
        }
        return `${safeJsonStringify(out)}\n`;
    }

    if (base.msg === undefined) {
        base.msg = "";
    }

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

function createSinkLogger(options: { fileSink: LogFileSink; consoleSink: StreamSink | null }): SinkLogger {
    const fileSink = options.fileSink;
    const consoleSink = options.consoleSink;

    const write = (level: LogLevelName, record: unknown) => {
        if (level === "debug" && config.debug !== 1) return;

        const sanitizedRecord = sanitizeLogObject(record as any, sanitizeOptions);
        const line = buildLogLine(level, sanitizedRecord);
        fileSink.enqueue(line);
        if (consoleSink) consoleSink.enqueue(line);
    };

    return {
        info(record: unknown) {
            write("info", record);
        },
        warn(record: unknown) {
            write("warn", record);
        },
        error(record: unknown) {
            write("error", record);
        },
        debug(record: unknown) {
            write("debug", record);
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

// 日志仅接受 1 个入参（任意类型）。
// - plain object（{}）直接作为 record
// - 其他任何类型：包装成对象再写入（避免 sink 层依赖入参类型）
function toRecord(input: unknown): LoggerRecord {
    if (isPlainObject(input)) {
        return input as LoggerRecord;
    }

    if (input instanceof Error) {
        return { err: input, msg: input.message || input.name || "Error" };
    }

    if (input === undefined) {
        return { msg: "" };
    }

    if (input === null) {
        return { msg: "null" };
    }

    // 非 plain object（数组/Date/Map/...）也走 value 包装，由 sanitize 负责做安全预览/截断。
    if (typeof input === "object") {
        return { value: input };
    }

    try {
        return { msg: String(input) };
    } catch {
        return { msg: "[Unserializable]" };
    }
}

function withRequestMetaRecord(record: LoggerRecord): LoggerRecord {
    const meta = metaToObject();
    if (!meta) return record;
    return mergeMetaIntoObject(record, meta);
}

class LoggerFacade {
    private maybeSanitizeForMock(record: LoggerRecord): LoggerRecord {
        if (!mockInstance) return record;
        return sanitizeLogObject(record, sanitizeOptions);
    }

    public info(input: unknown): any {
        const record0 = withRequestMetaRecord(toRecord(input));
        const record = this.maybeSanitizeForMock(record0);
        return getSink("app").info(record);
    }

    public warn(input: unknown): any {
        const record0 = withRequestMetaRecord(toRecord(input));
        const record = this.maybeSanitizeForMock(record0);
        return getSink("app").warn(record);
    }

    public error(input: unknown): any {
        const record0 = withRequestMetaRecord(toRecord(input));
        const record = this.maybeSanitizeForMock(record0);
        const ret = getSink("app").error(record);

        // 测试场景：启用 mock 时不做镜像，避免调用次数翻倍
        if (mockInstance) return ret;

        // error 专属文件：始终镜像一份
        getSink("error").error(record);
        return ret;
    }

    public debug(input: unknown): any {
        // debug!=1 则完全不记录 debug 日志（包括文件与控制台）
        if (config.debug !== 1) return;
        const record0 = withRequestMetaRecord(toRecord(input));
        const record = this.maybeSanitizeForMock(record0);
        return getSink("app").debug(record);
    }

    public async flush(): Promise<void> {
        await flush();
    }

    public configure(cfg: LoggerConfig): void {
        configure(cfg);
    }

    public setMock(mock: SinkLogger | null): void {
        setMockLogger(mock);
    }

    public async shutdown(): Promise<void> {
        await shutdown();
    }
}

/**
 * 日志实例（延迟初始化）
 */
export const Logger = new LoggerFacade();
