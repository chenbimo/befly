/**
 * Befly 配置模块
 * 自动加载 configs 目录下的配置文件并与默认配置合并
 * 支持环境分离：befly.common.json + befly.development/production.json
 */
import type { BeflyOptions } from "./types/befly";

import { join } from "node:path";

import { compileDisableMenuGlobRules } from "./utils/disableMenusGlob";
import { importDefault } from "./utils/importDefault";
import { mergeAndConcat } from "./utils/mergeAndConcat";

/** 默认配置 */
const defaultOptions: BeflyOptions = {
    // ========== 核心参数 ==========
    nodeEnv: "development",
    appName: "野蜂飞舞",
    appPort: 3000,
    appHost: "127.0.0.1",
    devEmail: "dev@qq.com",
    devPassword: "beflydev123456",
    bodyLimit: 1048576, // 1MB
    tz: "Asia/Shanghai",

    // ========== 日志配置 ==========
    logger: {
        debug: 1,
        excludeFields: ["password", "token", "secret"],
        dir: "./logs",
        console: 1,
        maxSize: 20, // 20MB
        maxStringLen: 100,
        maxArrayItems: 100
    },

    // ========== 数据库配置 ==========
    db: {
        type: "mysql",
        host: "127.0.0.1",
        port: 3306,
        username: "root",
        password: "root",
        database: "befly_demo",
        poolMax: 10
    },

    // ========== Redis 配置 ==========
    redis: {
        host: "127.0.0.1",
        port: 6379,
        username: "",
        password: "",
        db: 0,
        prefix: "befly_demo"
    },

    // ========== 认证配置 ==========
    auth: {
        secret: "befly-secret",
        expiresIn: "7d",
        algorithm: "HS256"
    },

    // ========== CORS 配置 ==========
    cors: {
        origin: "*",
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        allowedHeaders: "Content-Type,Authorization",
        exposedHeaders: "",
        maxAge: 86400,
        credentials: "true"
    },

    // ========== Hook：全局限流 ==========
    rateLimit: {
        enable: 1,
        // 默认兜底规则：所有接口按 IP 限流（如需更细粒度请配置 rules）
        defaultLimit: 1000,
        defaultWindow: 60,
        key: "ip",
        skipRoutes: [],
        rules: []
    },

    // ========== 菜单禁用配置 ==========
    disableMenus: ["**/404", "**/403", "**/500", "**/login"],

    // ========== Addon 配置 ==========
    addons: {}
};

const beflyConfigCache: Map<string, Promise<BeflyOptions>> = new Map();

export async function loadBeflyConfig(): Promise<BeflyOptions> {
    const nodeEnv = process.env.NODE_ENV || "development";
    const envSuffix = nodeEnv === "production" ? "production" : "development";

    const cacheKey = nodeEnv;
    const cached = beflyConfigCache.get(cacheKey);
    if (cached) {
        return await cached;
    }

    const promise = (async () => {
        // 使用 importDefault 加载 configs 目录下的配置文件。
        // 合并顺序：defaultOptions ← befly.common.json ← befly.development/production.json

        const configsDir = join(process.cwd(), "configs");

        const commonConfig = await importDefault(join(configsDir, "befly.common.json"), {});
        const envConfig = await importDefault(join(configsDir, `befly.${envSuffix}.json`), {});

        const config = mergeAndConcat(defaultOptions, commonConfig, envConfig);

        // 配置校验：redis.prefix 作为 key 前缀，由 RedisHelper 统一拼接 ":"。
        // 因此 prefix 本身不允许包含 ":"，否则会导致 key 结构出现空段或多段分隔（例如 "prefix::key"），
        // 在 RedisInsight 等工具里可能显示 [NO NAME] 空分组，且容易造成 key 管理混乱。
        const redisPrefix = (config as any)?.redis?.prefix;
        if (typeof redisPrefix === "string") {
            const trimmedPrefix = redisPrefix.trim();
            if (trimmedPrefix.includes(":")) {
                throw new Error(`配置错误：redis.prefix 不允许包含 ':'（RedisHelper 会自动拼接分隔符 ':'），请改为不带冒号的前缀，例如 'befly_demo'，当前值=${redisPrefix}`);
            }
        }

        // 预编译 disableMenus 的 Bun.Glob 规则：
        // - 提前暴露配置错误（fail-fast）
        // - 后续 checkMenu 会复用同一进程级缓存
        compileDisableMenuGlobRules((config as any)?.disableMenus);

        return config as BeflyOptions;
    })();

    beflyConfigCache.set(cacheKey, promise);
    try {
        return await promise;
    } catch (error: any) {
        beflyConfigCache.delete(cacheKey);
        throw error;
    }
}
