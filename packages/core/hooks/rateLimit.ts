// 类型导入
import type { Hook } from "../types/hook.js";

import { beflyConfig } from "../befly.config.js";

// 相对导入
import { ErrorResponse } from "../utils/response.js";

/**
 * 限流 key 维度
 * - ip: 仅按 IP
 * - user: 仅按用户（缺失 ctx.user.id 时回退为按 IP，避免匿名共享同一计数桶）
 * - ip_user: IP + 用户（缺失用户时视为 anonymous）
 */
type RateLimitKeyMode = "ip" | "user" | "ip_user";

/**
 * 单条限流规则
 * route 匹配串：
 * - 精确："POST/api/auth/login"
 * - 前缀："POST/api/auth/*" 或 "/api/auth/*"
 * - 全量："*"
 */
type RateLimitRule = {
    route: string;
    /** 窗口期内允许次数 */
    limit: number;
    /** 窗口期秒数 */
    window: number;
    /** 计数维度（默认 ip） */
    key?: RateLimitKeyMode;
};

/** 全局请求限流配置（Hook） */
type RateLimitConfig = {
    /** 是否启用 (0/1) */
    enable?: number;
    /** 未命中 rules 时的默认次数（<=0 表示不启用默认规则） */
    defaultLimit?: number;
    /** 未命中 rules 时的默认窗口秒数（<=0 表示不启用默认规则） */
    defaultWindow?: number;
    /** 默认计数维度（默认 ip） */
    key?: RateLimitKeyMode;
    /**
     * 直接跳过限流的路由列表（优先级最高）
     * - 精确："POST/api/health" 或 "/api/health"
     * - 前缀："POST/api/health/*" 或 "/api/health/*"
     */
    skipRoutes?: string[];
    /** 路由规则列表 */
    rules?: RateLimitRule[];
};

type MemoryBucket = {
    count: number;
    resetAt: number;
};

const memoryBuckets = new Map<string, MemoryBucket>();
let nextSweepAt = 0;

function matchRoute(ruleRoute: string, actualRoute: string): boolean {
    if (ruleRoute === "*") return true;

    if (ruleRoute.endsWith("*")) {
        const prefix = ruleRoute.slice(0, -1);
        if (prefix.startsWith("/")) {
            return actualRoute.includes(prefix);
        }
        return actualRoute.startsWith(prefix);
    }

    if (ruleRoute.startsWith("/")) {
        return actualRoute.endsWith(ruleRoute);
    }

    return actualRoute === ruleRoute;
}

function calcRouteMatchScore(ruleRoute: string, actualRoute: string): number {
    if (!ruleRoute || typeof ruleRoute !== "string") return -1;

    // 兜底通配：最低优先级
    if (ruleRoute === "*") return 0;

    // 完全精确：最高优先级
    if (ruleRoute === actualRoute) return 400000 + ruleRoute.length;

    // 以 / 开头：只匹配 path（忽略 method），用于 /api/* 这类
    if (ruleRoute.startsWith("/")) {
        if (ruleRoute.endsWith("*")) {
            const prefix = ruleRoute.slice(0, -1);
            if (actualRoute.includes(prefix)) {
                return 100000 + prefix.length;
            }
            return -1;
        }

        if (actualRoute.endsWith(ruleRoute)) {
            return 300000 + ruleRoute.length;
        }

        return -1;
    }

    // 不以 / 开头：匹配包含 method 的完整串，如 POST/api/auth/*
    if (ruleRoute.endsWith("*")) {
        const prefix = ruleRoute.slice(0, -1);
        if (actualRoute.startsWith(prefix)) {
            return 200000 + prefix.length;
        }
        return -1;
    }

    // 其他兜底（理论上到不了，因为精确已在上面处理；这里为了兼容 matchRoute 的未来扩展）
    if (matchRoute(ruleRoute, actualRoute)) {
        return 50000 + ruleRoute.length;
    }

    return -1;
}

function shouldSkip(config: RateLimitConfig, actualRoute: string): boolean {
    const skipRoutes = Array.isArray(config.skipRoutes) ? config.skipRoutes : [];
    if (skipRoutes.length === 0) return false;

    for (const skip of skipRoutes) {
        if (typeof skip !== "string" || !skip) continue;
        if (matchRoute(skip, actualRoute)) return true;
    }

    return false;
}

function pickRule(config: RateLimitConfig, actualRoute: string): RateLimitRule | null {
    const rules = Array.isArray(config.rules) ? config.rules : [];

    let bestRule: RateLimitRule | null = null;
    let bestScore = -1;

    // 多条命中时，优先更“具体”的规则（精确 > 前缀 > 通配）；同等具体度按 rules 的先后顺序
    for (const rule of rules) {
        if (!rule || typeof rule.route !== "string") continue;

        const score = calcRouteMatchScore(rule.route, actualRoute);
        if (score > bestScore) {
            bestRule = rule;
            bestScore = score;
        }
    }

    if (bestRule) return bestRule;

    const defaultLimit = typeof config.defaultLimit === "number" ? config.defaultLimit : 0;
    const defaultWindow = typeof config.defaultWindow === "number" ? config.defaultWindow : 0;

    if (defaultLimit > 0 && defaultWindow > 0) {
        return {
            route: "*",
            limit: defaultLimit,
            window: defaultWindow,
            key: config.key
        };
    }

    return null;
}

function buildIdentity(ctx: any, mode: RateLimitKeyMode): string {
    const ip = typeof ctx.ip === "string" ? ctx.ip : "unknown";

    const userIdValue = ctx.user && (typeof ctx.user.id === "number" || typeof ctx.user.id === "string") ? ctx.user.id : null;
    const userId = userIdValue !== null ? String(userIdValue) : "";

    if (mode === "ip") {
        return `ip:${ip}`;
    }

    if (mode === "user") {
        // 未登录/无 userId：回退为按 IP 计数，避免所有匿名用户共享同一 bucket
        if (userId) return `user:${userId}`;
        return `ip:${ip}`;
    }

    if (mode === "ip_user") {
        if (userId) {
            return `ip:${ip}:user:${userId}`;
        }
        return `ip:${ip}:user:anonymous`;
    }

    return `ip:${ip}`;
}

function hitMemoryBucket(key: string, windowSeconds: number): number {
    const now = Date.now();

    if (now >= nextSweepAt) {
        nextSweepAt = now + 60_000;
        for (const [k, v] of memoryBuckets.entries()) {
            if (!v || typeof v.resetAt !== "number") {
                memoryBuckets.delete(k);
                continue;
            }
            if (v.resetAt <= now) {
                memoryBuckets.delete(k);
            }
        }
    }

    const existing = memoryBuckets.get(key);
    if (!existing || existing.resetAt <= now) {
        const bucket: MemoryBucket = {
            count: 1,
            resetAt: now + windowSeconds * 1000
        };
        memoryBuckets.set(key, bucket);
        return bucket.count;
    }

    existing.count += 1;
    return existing.count;
}

/**
 * 请求限流钩子（全局）
 * - 通过 beflyConfig.rateLimit 开启/配置
 * - 默认启用：可通过配置禁用或调整阈值
 */
const hook: Hook = {
    order: 7,
    handler: async (befly, ctx) => {
        const config = beflyConfig.rateLimit as RateLimitConfig | undefined;

        if (!config || config.enable !== 1) return;
        if (!ctx.api) return;
        if (ctx.req && ctx.req.method === "OPTIONS") return;

        // 跳过名单：命中后不计数也不拦截（优先级最高）
        if (shouldSkip(config, ctx.route)) return;

        const rule = pickRule(config, ctx.route);
        if (!rule) return;

        const limit = typeof rule.limit === "number" ? rule.limit : 0;
        const windowSeconds = typeof rule.window === "number" ? rule.window : 0;
        if (limit <= 0 || windowSeconds <= 0) return;

        const keyMode = rule.key || config.key || "ip";
        const identity = buildIdentity(ctx, keyMode);
        const counterKey = `rate_limit:${ctx.route}:${identity}`;

        let count = 0;
        if (befly.redis) {
            count = await befly.redis.incrWithExpire(counterKey, windowSeconds);
        } else {
            count = hitMemoryBucket(counterKey, windowSeconds);
        }

        if (count > limit) {
            ctx.response = ErrorResponse(
                ctx,
                "请求过于频繁，请稍后再试",
                1,
                null,
                {
                    limit: limit,
                    window: windowSeconds
                },
                "rateLimit"
            );
            return;
        }
    }
};

export default hook;
