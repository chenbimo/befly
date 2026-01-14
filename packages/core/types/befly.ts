/**
 * Befly 核心框架类型定义
 */

import type { CacheHelper } from "./cache";
import type { CipherStatic } from "./cipher";
import type { JsonValue } from "./common";
import type { RequestContext } from "./context";
import type { DbHelper } from "./database";
import type { Jwt } from "./jwt";
import type { Logger, LoggerConfig } from "./logger";
import type { RedisHelper } from "./redis";
import type { ValidatorStatic } from "./validate";

export type { LoggerConfig };

/**
 * 运行时环境变量快照（由宿主应用传入，Befly.start(env) 注入到 ctx.env）
 */
export type BeflyRuntimeEnv = Record<string, string | undefined>;

/**
 * 数据库配置
 */
export interface DatabaseConfig {
    /** 是否启用数据库 (0: 关闭, 1: 开启) @default 0 */
    enable?: number;
    /** 数据库主机 @default '127.0.0.1' */
    host?: string;
    /** 数据库端口 @default 3306 */
    port?: number;
    /** 数据库用户名 @default 'root' */
    username?: string;
    /** 数据库密码 @default '' */
    password?: string;
    /** 数据库名称 @default 'befly' */
    database?: string;
    /** 连接池最大连接数 @default 1 */
    poolMax?: number;
}

/**
 * Redis 配置
 */
export interface RedisConfig {
    /** Redis 主机 @default '127.0.0.1' */
    host?: string;
    /** Redis 端口 @default 6379 */
    port?: number;
    /** Redis 用户名 @default '' */
    username?: string;
    /** Redis 密码 @default '' */
    password?: string;
    /** Redis 数据库索引 @default 0 */
    db?: number;
    /** Redis Key 前缀 @default 'befly:' */
    prefix?: string;
}

/**
 * JWT 配置
 */
export interface AuthConfig {
    /** JWT 密钥 @default 'befly-secret' */
    secret?: string;
    /** 过期时间 @default '7d' */
    expiresIn?: string | number;
    /** 签名算法 @default 'HS256' */
    algorithm?: string;
}

/**
 * CORS 配置
 */
export interface CorsConfig {
    /** 允许的来源 @default '*' */
    origin?: string;
    /** 允许的方法 @default 'GET,HEAD,PUT,PATCH,POST,DELETE' */
    methods?: string;
    /** 允许的头 @default 'Content-Type,Authorization' */
    allowedHeaders?: string;
    /** 暴露的头 @default '' */
    exposedHeaders?: string;
    /** 预检请求缓存时间 (秒) @default 86400 */
    maxAge?: number;
    /** 是否允许凭证 @default 'true' */
    credentials?: string;
}

/**
 * 全局请求限流配置（Hook）
 */
export interface RateLimitRule {
    /**
     * 路由匹配串
     * - 精确："/api/auth/login"
     * - 前缀："/api/auth/*"
     * - 全量："*"
     */
    route: string;
    /** 窗口期内允许次数 */
    limit: number;
    /** 窗口期秒数 */
    window: number;
    /** 计数维度（默认 ip） */
    key?: "ip" | "user" | "ip_user";
}

export interface RateLimitConfig {
    /** 是否启用 (0/1) */
    enable?: number;
    /** 未命中 rules 时的默认次数（<=0 表示不启用默认规则） */
    defaultLimit?: number;
    /** 未命中 rules 时的默认窗口秒数（<=0 表示不启用默认规则） */
    defaultWindow?: number;
    /** 默认计数维度（默认 ip） */
    key?: "ip" | "user" | "ip_user";
    /**
     * 直接跳过限流的路由列表（优先级最高）
     * - 精确："/api/health"
     * - 前缀："/api/health/*"
     */
    skipRoutes?: string[];
    /** 路由规则列表 */
    rules?: RateLimitRule[];
}

/**
 * Befly 构造函数选项（最多 2 级结构）
 */
export interface BeflyOptions {
    // ========== 核心参数 ==========
    /** 运行环境 ('development' | 'production') @default 'development' */
    nodeEnv?: string;
    /** 应用名称 @default 'Befly App' */
    appName?: string;
    /** 应用端口 @default 3000 */
    appPort?: number;
    /** 应用主机 @default '0.0.0.0' */
    appHost?: string;
    /** 开发者邮箱 (用于 syncDev) @default 'dev@qq.com' */
    devEmail?: string;
    /** 开发者密码 (用于 syncDev) */
    devPassword?: string;
    /** 请求体大小限制 (字节) @default 1048576 (1MB) */
    bodyLimit?: number;
    /** 时区 @default 'Asia/Shanghai' */
    tz?: string;

    // ========== 插件配置 ==========
    /** 日志插件配置 */
    logger?: LoggerConfig;
    /** 数据库插件配置 */
    db?: DatabaseConfig;
    /** Redis 插件配置 */
    redis?: RedisConfig;
    /** 认证插件配置 */
    auth?: AuthConfig;
    /** CORS 插件配置 */
    cors?: CorsConfig;

    /** 全局请求限流配置（Hook） */
    rateLimit?: RateLimitConfig;
    /**
     * 禁用的菜单 path 规则（用于菜单同步与加载前过滤）
     *
     * 仅支持 Bun.Glob 的 glob pattern 语法与 API（即把每条规则当作 glob 模式匹配菜单 path）。
     * 示例：
     * - 精确："/addon/admin/login"
     * - 通配："/addon/admin/log/*"、"/addon/admin/**"、"**\/login"
     */
    disableMenus?: string[];
    /**
     * Addon 运行时配置
     * 按 addon 名称分组，如 addons.admin.email
     */
    addons?: Record<string, Record<string, JsonValue | undefined>>;
    /** 其他插件配置 */
    [key: string]: unknown;
}

/**
 * Befly 应用上下文
 * 包含所有插件挂载的实例
 */
export interface BeflyContext {
    // ========== 核心插件 ==========
    /** 数据库助手 */
    db: DbHelper;

    /** Redis 助手 */
    redis: RedisHelper;

    /** 日志器 */
    logger: Logger;

    /** 缓存助手 */
    cache: CacheHelper;

    /** 工具函数 */
    tool: {
        Yes: <TData extends JsonValue = JsonValue, TOther extends Record<string, JsonValue | undefined> = Record<string, JsonValue | undefined>>(msg: string, data?: TData, other?: TOther) => { code: 0; msg: string; data: TData } & TOther;
        No: <TData extends JsonValue = JsonValue, TOther extends Record<string, JsonValue | undefined> = Record<string, JsonValue | undefined>>(msg: string, data?: TData, other?: TOther) => { code: 1; msg: string; data: TData } & TOther;
        Raw: (
            ctx: RequestContext,
            data: JsonValue | string,
            options?: {
                status?: number;
                contentType?: string;
                headers?: Record<string, string>;
            }
        ) => Response;
    };

    /** 加密解密 */
    cipher: CipherStatic;

    /** JWT 令牌 */
    jwt: Jwt;

    /** 项目配置 */
    config: BeflyOptions;

    /** 运行时环境变量快照（由宿主传入） */
    env: BeflyRuntimeEnv;

    // ========== 动态插件 ==========
    /** 组件插件：addon_{addonName}_{pluginName} */
    /** 项目插件：app_{pluginName} */
    [key: string]: unknown;
}

/**
 * Validator 静态类（注入到 ctx 的用法）
 *
 * 说明：这不是 befly 默认入口的运行时导出；仅用于在框架内部/插件中提供类型约束。
 */
export type Validator = ValidatorStatic;
