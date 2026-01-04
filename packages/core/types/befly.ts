/**
 * Befly 核心框架类型定义
 */

import type { CacheHelper } from "../lib/cacheHelper.ts";
import type { Cipher } from "../lib/cipher.ts";
import type { DbHelper } from "../lib/dbHelper.ts";
import type { Jwt } from "../lib/jwt.ts";
import type { Logger } from "../lib/logger.ts";
import type { RedisHelper } from "../lib/redisHelper.ts";
import type { Validator } from "../lib/validator.ts";
import type { ApiRoute } from "./api.ts";
import type { KeyValue } from "./common.ts";
import type { LoggerConfig } from "./logger.ts";
import type { Plugin } from "./plugin.ts";

export type { LoggerConfig };

/**
 * 数据库配置
 */
export interface DatabaseConfig {
    /** 是否启用数据库 (0: 关闭, 1: 开启) @default 0 */
    enable?: number;
    /** 数据库类型 ('mysql' | 'postgres' | 'sqlite') @default 'sqlite' */
    type?: string;
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
    /** 禁用的钩子列表 */
    disableHooks?: string[];
    /** 禁用的插件列表 */
    disablePlugins?: string[];
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
    addons?: Record<string, Record<string, any>>;
    /** 其他插件配置 */
    [key: string]: any;
}

/**
 * Befly 应用上下文
 * 包含所有插件挂载的实例
 */
export interface BeflyContext extends KeyValue {
    // ========== 核心插件 ==========
    /** 数据库助手 */
    db: DbHelper;

    /** Redis 助手 */
    redis: RedisHelper;

    /** 日志器 */
    logger: typeof Logger;

    /** 缓存助手 */
    cache: CacheHelper;

    /** 工具函数 */
    tool: {
        Yes: (msg: string, data?: any, other?: Record<string, any>) => { code: 0; msg: string; data: any };
        No: (msg: string, data?: any, other?: Record<string, any>) => { code: 1; msg: string; data: any };
    };

    /** 加密解密 */
    cipher: typeof Cipher;

    /** JWT 令牌 */
    jwt: Jwt;

    /** 项目配置 */
    config: BeflyOptions;

    // ========== 动态插件 ==========
    /** 组件插件：addon_{addonName}_{pluginName} */
    /** 项目插件：app_{pluginName} */
    [key: string]: any;
}

/**
 * Befly 核心类
 */
export interface Befly {
    /** API 路由映射 */
    apis: Map<string, ApiRoute>;

    /** 插件列表 */
    plugins: Plugin[];

    /** 应用上下文 */
    context: KeyValue;

    /** 应用选项 */
    appOptions: BeflyOptions;

    /** 日志器 */
    logger: typeof Logger;

    /** JWT 工具 */
    jwt: Jwt;

    /** 验证器 */
    validator: Validator;

    /** SQL 管理器 */
    sql: DbHelper;

    /** 加密工具 */
    crypto: Cipher;

    /** 数据库连接 */
    db: any;

    /** Redis 连接 */
    redis: any;

    /**
     * 初始化检查器
     */
    initCheck(): Promise<void>;

    /**
     * 加载插件
     */
    loadPlugins(): Promise<void>;

    /**
     * 加载 API 路由
     */
    loadApis(): Promise<void>;

    /**
     * 启动服务器
     */
    start(): Promise<void>;

    /**
     * 停止服务器
     */
    stop(): Promise<void>;

    /**
     * 处理请求
     */
    handleRequest(request: Request): Promise<Response>;

    /**
     * 注册钩子
     */
    use(hook: Function): void;

    /**
     * 获取配置
     */
    getConfig(key: string): any;

    /**
     * 设置配置
     */
    setConfig(key: string, value: any): void;
}

/**
 * Befly 构造函数类型
 */
export interface BeflyConstructor {
    new (options?: BeflyOptions): Befly;
}

/**
 * 服务器启动选项
 */
export interface ServerOptions {
    /** 主机名 */
    hostname: string;

    /** 端口 */
    port: number;

    /** 请求处理函数 */
    fetch: (request: Request) => Promise<Response>;

    /** 错误处理函数 */
    error?: (error: Error) => Response;

    /** 开发模式 */
    development?: boolean;
}

/**
 * 服务器实例
 */
export interface Server {
    /** 主机名 */
    hostname: string;

    /** 端口 */
    port: number;

    /** 停止服务器 */
    stop(): Promise<void>;

    /** 重启服务器 */
    reload(options: ServerOptions): void;
}

/**
 * 检查函数类型
 */
export type CheckFunction = (befly: Befly) => Promise<void> | void;

/**
 * 检查结果
 */
export interface CheckResult {
    /** 文件名 */
    filename: string;

    /** 检查名称 */
    checkName: string;

    /** 是否通过 */
    passed: boolean;

    /** 执行时间（纳秒） */
    duration: number;

    /** 错误信息 */
    error?: Error;
}

/**
 * 性能统计
 */
export interface PerformanceStats {
    /** 启动时间 */
    startTime: number;

    /** 检查时间 */
    checkTime: number;

    /** 插件加载时间 */
    pluginTime: number;

    /** API 加载时间 */
    apiTime: number;

    /** 总时间 */
    totalTime: number;
}

/**
 * 导出 Befly 实例创建函数
 */
export declare function createBefly(options?: BeflyOptions): Befly;
