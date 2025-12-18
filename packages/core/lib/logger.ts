/**
 * 日志系统 - 基于 pino 实现
 */

import type { LoggerConfig } from "../types/logger.js";

import { readdir, stat, unlink } from "node:fs/promises";
import { join as nodePathJoin } from "node:path";

import { isPlainObject } from "es-toolkit/compat";
import { escapeRegExp } from "es-toolkit/string";
import { join } from "pathe";
import pino from "pino";

import { getCtx } from "./asyncContext.js";

const MAX_LOG_STRING_LEN = 100;
const MAX_LOG_ARRAY_ITEMS = 100;

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const BUILTIN_SENSITIVE_KEYS = ["*password*", "pass", "pwd", "*token*", "access_token", "refresh_token", "accessToken", "refreshToken", "authorization", "cookie", "set-cookie", "*secret*", "apiKey", "api_key", "privateKey", "private_key"];

let sensitiveKeySet: Set<string> = new Set();
let sensitiveSuffixMatchers: string[] = [];
let sensitivePrefixMatchers: string[] = [];
let sensitiveContainsMatchers: string[] = [];
let sensitiveContainsRegex: RegExp | null = null;

let instance: pino.Logger | null = null;
let slowInstance: pino.Logger | null = null;
let errorInstance: pino.Logger | null = null;
let mockInstance: pino.Logger | null = null;
let didPruneOldLogFiles: boolean = false;
let config: LoggerConfig = {
    debug: 0,
    dir: "./logs",
    console: 1,
    maxSize: 10
};

async function pruneOldLogFiles(): Promise<void> {
    if (didPruneOldLogFiles) return;
    didPruneOldLogFiles = true;

    const dir = config.dir || "./logs";
    const now = Date.now();
    const cutoff = now - ONE_YEAR_MS;

    try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile()) continue;

            const name = entry.name;

            // 只处理本项目的日志文件前缀
            const isTarget = name.startsWith("app.") || name.startsWith("slow.") || name.startsWith("error.");
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
    config = { ...config, ...cfg };
    instance = null;
    slowInstance = null;
    errorInstance = null;
    didPruneOldLogFiles = false;

    // 仅支持数组配置：excludeFields?: string[]
    const userPatterns = Array.isArray(config.excludeFields) ? config.excludeFields : [];
    const patterns = [...BUILTIN_SENSITIVE_KEYS, ...userPatterns]
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0)
        .map((item) => item.toLowerCase());

    const exactSet = new Set<string>();
    const suffixMatchers: string[] = [];
    const prefixMatchers: string[] = [];
    const containsMatchers: string[] = [];

    for (const pat of patterns) {
        // 支持通配符：
        // - *secret  -> 后缀匹配
        // - secret*  -> 前缀匹配
        // - *secret* -> 包含匹配
        // - 无 *     -> 精确匹配（建议用 *x* 显式开启模糊匹配）
        const hasStar = pat.includes("*");
        if (!hasStar) {
            exactSet.add(pat);
            continue;
        }

        const trimmed = pat.replace(/\*+/g, "*");
        const startsStar = trimmed.startsWith("*");
        const endsStar = trimmed.endsWith("*");
        const core = trimmed.replace(/^\*+|\*+$/g, "");
        if (!core) {
            continue;
        }

        if (startsStar && !endsStar) {
            suffixMatchers.push(core);
            continue;
        }
        if (!startsStar && endsStar) {
            prefixMatchers.push(core);
            continue;
        }

        // *core* 或类似 a*b：都降级为包含匹配
        containsMatchers.push(core);
    }

    sensitiveKeySet = exactSet;
    sensitiveSuffixMatchers = suffixMatchers;
    sensitivePrefixMatchers = prefixMatchers;
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
 * @param mock - Mock pino 实例，传 null 清除 mock
 */
export function setMockLogger(mock: pino.Logger | null): void {
    mockInstance = mock;
}

/**
 * 获取 pino 日志实例
 */
export function getLogger(): pino.Logger {
    // 优先返回 mock 实例（用于测试）
    if (mockInstance) return mockInstance;

    if (instance) return instance;

    // 启动时清理过期日志（异步，不阻塞初始化）
    void pruneOldLogFiles();

    const level = config.debug === 1 ? "debug" : "info";
    const targets: pino.TransportTargetOptions[] = [];

    // 文件输出
    targets.push({
        target: "pino-roll",
        level: level,
        options: {
            file: join(config.dir || "./logs", "app"),
            frequency: "daily",
            size: `${config.maxSize || 10}m`,
            mkdir: true,
            dateFormat: "yyyy-MM-dd"
        }
    });

    // 控制台输出
    if (config.console === 1) {
        targets.push({
            target: "pino/file",
            level: level,
            options: { destination: 1 }
        });
    }

    instance = pino({
        level: level,
        transport: { targets: targets }
    });

    return instance;
}

function getSlowLogger(): pino.Logger {
    if (mockInstance) return mockInstance;
    if (slowInstance) return slowInstance;

    void pruneOldLogFiles();

    const level = config.debug === 1 ? "debug" : "info";
    slowInstance = pino({
        level: level,
        transport: {
            targets: [
                {
                    target: "pino-roll",
                    level: level,
                    options: {
                        file: join(config.dir || "./logs", "slow"),
                        // 只按大小分割（frequency 默认不启用）
                        size: `${config.maxSize || 10}m`,
                        mkdir: true
                    }
                }
            ]
        }
    });

    return slowInstance;
}

function getErrorLogger(): pino.Logger {
    if (mockInstance) return mockInstance;
    if (errorInstance) return errorInstance;

    void pruneOldLogFiles();

    // error 专属文件：只关注 error 及以上
    errorInstance = pino({
        level: "error",
        transport: {
            targets: [
                {
                    target: "pino-roll",
                    level: "error",
                    options: {
                        file: join(config.dir || "./logs", "error"),
                        // 只按大小分割（frequency 默认不启用）
                        size: `${config.maxSize || 10}m`,
                        mkdir: true
                    }
                }
            ]
        }
    });

    return errorInstance;
}

function truncateString(val: string, stats: Record<string, number>): string {
    if (val.length <= MAX_LOG_STRING_LEN) return val;
    stats.truncatedStrings = (stats.truncatedStrings || 0) + 1;
    return val.slice(0, MAX_LOG_STRING_LEN);
}

function safeToString(val: any, visited: WeakSet<object>, stats: Record<string, number>): string {
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
            stats.circularRefs = (stats.circularRefs || 0) + 1;
            return "[Circular]";
        }
    }

    try {
        const localVisited = visited;
        const replacer = (_k: string, v: any) => {
            if (v && typeof v === "object") {
                if (localVisited.has(v as object)) {
                    stats.circularRefs = (stats.circularRefs || 0) + 1;
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

function isSensitiveKey(key: string): boolean {
    const lower = String(key).toLowerCase();
    if (sensitiveKeySet.has(lower)) return true;

    for (const suffix of sensitiveSuffixMatchers) {
        if (lower.endsWith(suffix)) return true;
    }
    for (const prefix of sensitivePrefixMatchers) {
        if (lower.startsWith(prefix)) return true;
    }

    if (sensitiveContainsRegex) {
        return sensitiveContainsRegex.test(lower);
    }

    for (const part of sensitiveContainsMatchers) {
        if (lower.includes(part)) return true;
    }

    return false;
}

function sanitizeNestedValue(val: any, visited: WeakSet<object>, stats: Record<string, number>): any {
    if (val === null || val === undefined) return val;
    if (typeof val === "string") return truncateString(val, stats);
    if (typeof val === "number") return val;
    if (typeof val === "boolean") return val;
    if (typeof val === "bigint") return val;

    if (val instanceof Error) {
        const errObj: Record<string, any> = {
            name: val.name || "Error",
            message: truncateString(val.message || "", stats)
        };
        if (typeof val.stack === "string") {
            errObj.stack = truncateString(val.stack, stats);
        }
        return errObj;
    }

    // 对象/数组：不再深入，转为字符串并截断
    stats.valuesStringified = (stats.valuesStringified || 0) + 1;
    const str = safeToString(val, visited, stats);
    return truncateString(str, stats);
}

function sanitizeObjectFirstLayer(obj: Record<string, any>, visited: WeakSet<object>, stats: Record<string, number>): Record<string, any> {
    if (visited.has(obj)) {
        stats.circularRefs = (stats.circularRefs || 0) + 1;
        return { value: "[Circular]" };
    }
    visited.add(obj);

    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
        if (isSensitiveKey(key)) {
            stats.maskedKeys = (stats.maskedKeys || 0) + 1;
            out[key] = "[MASKED]";
            continue;
        }
        out[key] = sanitizeNestedValue(val, visited, stats);
    }
    return out;
}

function sanitizeArray(arr: any[], visited: WeakSet<object>, stats: Record<string, number>): any[] {
    const max = MAX_LOG_ARRAY_ITEMS;
    const len = arr.length;
    const limit = len > max ? max : len;

    const out: any[] = [];
    for (let i = 0; i < limit; i++) {
        const item = arr[i];
        if (item && typeof item === "object" && !Array.isArray(item) && !(item instanceof Error)) {
            out.push(sanitizeObjectFirstLayer(item as Record<string, any>, visited, stats));
            continue;
        }
        if (item instanceof Error) {
            const errObj: Record<string, any> = {
                name: item.name || "Error",
                message: truncateString(item.message || "", stats)
            };
            if (typeof item.stack === "string") {
                errObj.stack = truncateString(item.stack, stats);
            }
            out.push(errObj);
            continue;
        }
        if (typeof item === "string") {
            out.push(truncateString(item, stats));
            continue;
        }
        if (typeof item === "number" || typeof item === "boolean" || item === null || item === undefined) {
            out.push(item);
            continue;
        }
        if (typeof item === "bigint") {
            out.push(item);
            continue;
        }

        // 其他类型（包含子数组等）转字符串预览
        stats.valuesStringified = (stats.valuesStringified || 0) + 1;
        const str = safeToString(item, visited, stats);
        out.push(truncateString(str, stats));
    }

    if (len > max) {
        stats.arraysTruncated = (stats.arraysTruncated || 0) + 1;
        stats.arrayItemsOmitted = (stats.arrayItemsOmitted || 0) + (len - max);
    }

    return out;
}

function sanitizeTopValue(val: any, visited: WeakSet<object>, stats: Record<string, number>): any {
    if (val === null || val === undefined) return val;
    if (typeof val === "string") return truncateString(val, stats);
    if (typeof val === "number") return val;
    if (typeof val === "boolean") return val;
    if (typeof val === "bigint") return val;
    if (val instanceof Error) {
        const errObj: Record<string, any> = {
            name: val.name || "Error",
            message: truncateString(val.message || "", stats)
        };
        if (typeof val.stack === "string") {
            errObj.stack = truncateString(val.stack, stats);
        }
        return errObj;
    }
    if (Array.isArray(val)) return sanitizeArray(val, visited, stats);
    if (isPlainObject(val)) return sanitizeObjectFirstLayer(val as Record<string, any>, visited, stats);

    stats.valuesStringified = (stats.valuesStringified || 0) + 1;
    const str = safeToString(val, visited, stats);
    return truncateString(str, stats);
}

function sanitizeLogObject(obj: Record<string, any>): Record<string, any> {
    const visited = new WeakSet<object>();
    const stats: Record<string, number> = {
        maskedKeys: 0,
        truncatedStrings: 0,
        arraysTruncated: 0,
        arrayItemsOmitted: 0,
        valuesStringified: 0,
        circularRefs: 0
    };

    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
        if (isSensitiveKey(key)) {
            stats.maskedKeys = stats.maskedKeys + 1;
            out[key] = "[MASKED]";
            continue;
        }
        out[key] = sanitizeTopValue(val, visited, stats);
    }

    const hasChanges = stats.maskedKeys > 0 || stats.truncatedStrings > 0 || stats.arraysTruncated > 0 || stats.arrayItemsOmitted > 0 || stats.valuesStringified > 0 || stats.circularRefs > 0;

    if (hasChanges) {
        out.logTrimStats = {
            maskedKeys: stats.maskedKeys,
            truncatedStrings: stats.truncatedStrings,
            arraysTruncated: stats.arraysTruncated,
            arrayItemsOmitted: stats.arrayItemsOmitted,
            valuesStringified: stats.valuesStringified,
            circularRefs: stats.circularRefs
        };
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

function shouldMirrorToSlow(args: any[]): boolean {
    // 测试场景：启用 mock 时不做镜像，避免调用次数翻倍
    if (mockInstance) return false;
    if (!args || args.length === 0) return false;
    const first = args[0];
    if (!isPlainObject(first)) return false;

    // 优先使用显式标记：event=slow
    const event = (first as any).event;
    if (event === "slow") return true;

    // 兼容旧写法：仅通过 message emoji 判断（尽量少用）
    const msg = args.length > 1 ? args[1] : undefined;
    if (typeof msg === "string" && msg.includes("🐌")) return true;

    return false;
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
        if (mockInstance) return ret;
        if (shouldMirrorToSlow(finalArgs as any[])) {
            const slowLogger = getSlowLogger();
            (slowLogger.info as any).apply(slowLogger, finalArgs);
        }
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
        if (mockInstance) return ret;
        if (shouldMirrorToSlow(finalArgs as any[])) {
            const slowLogger = getSlowLogger();
            (slowLogger.warn as any).apply(slowLogger, finalArgs);
        }
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

        // error 同时也属于 slow？一般不会，但允许显式 event=slow
        if (shouldMirrorToSlow(finalArgs as any[])) {
            const slowLogger = getSlowLogger();
            (slowLogger.error as any).apply(slowLogger, finalArgs);
        }

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
        if (mockInstance) return ret;
        if (shouldMirrorToSlow(finalArgs as any[])) {
            const slowLogger = getSlowLogger();
            (slowLogger.debug as any).apply(slowLogger, finalArgs);
        }
        return ret;
    },
    configure: configure,
    setMock: setMockLogger
};
