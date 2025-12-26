/**
 * Befly 配置模块
 * 自动加载 configs 目录下的配置文件并与默认配置合并
 * 支持环境分离：befly.common.json + befly.development/production.json
 */
import type { BeflyOptions } from "./types/befly.js";

import { compileDisableMenuGlobRules } from "./utils/disableMenusGlob.js";
import { scanConfig } from "./utils/scanConfig.js";

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
        maxSize: 10485760 // 10MB
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
        prefix: "befly_demo:"
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

    // ========== 禁用配置 ==========
    disableHooks: [],
    disablePlugins: [],
    disableMenus: ["/404", "/403", "/500", "/login", "/addon/admin/login"],

    // ========== Addon 配置 ==========
    addons: {}
};

export type LoadBeflyConfigOptions = {
    cwd?: string;
    nodeEnv?: string;
};

export async function loadBeflyConfig(options: LoadBeflyConfigOptions = {}): Promise<BeflyOptions> {
    const nodeEnv = options.nodeEnv || process.env.NODE_ENV || "development";
    const envSuffix = nodeEnv === "production" ? "production" : "development";

    // 使用 scanConfig 一次性加载并合并所有配置文件
    // 合并顺序：defaultOptions ← befly.common.json ← befly.development/production.json
    const config = await scanConfig({
        cwd: options.cwd,
        dirs: ["configs"],
        files: ["befly.common", `befly.${envSuffix}`],
        extensions: [".json"],
        mode: "merge",
        defaults: defaultOptions
    });

    // 预编译 disableMenus 的 Bun.Glob 规则：
    // - 提前暴露配置错误（fail-fast）
    // - 后续 checkMenu 会复用同一进程级缓存
    compileDisableMenuGlobRules((config as any)?.disableMenus);

    return config as BeflyOptions;
}

export const beflyConfig = await loadBeflyConfig();
