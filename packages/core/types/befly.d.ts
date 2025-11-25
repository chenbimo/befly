/**
 * Befly 核心框架类型定义
 */

import type { Plugin } from './plugin.js';
import type { ApiRoute, HttpMethod } from './api.js';
import type { KeyValue } from './common.js';
import type { Logger } from '../lib/logger.js';
import type { Jwt } from '../lib/jwt.js';
import type { Validator } from '../lib/validator.js';
import type { Database } from 'bun:sqlite';
import type { DbHelper } from '../lib/dbHelper.js';
import type { RedisHelper } from '../lib/redisHelper.js';
import type { Cipher } from '../lib/cipher.js';
import type { CacheHelper } from '../lib/cacheHelper.js';

/**
 * 日志配置
 */
export interface LoggerConfig {
    /** 是否开启调试模式 (0: 关闭, 1: 开启) @default 1 */
    debug?: number;
    /** 日志排除字段 (逗号分隔) @default 'password,token,secret' */
    excludeFields?: string;
    /** 日志目录 @default './logs' */
    dir?: string;
    /** 是否输出到控制台 (0: 关闭, 1: 开启) @default 1 */
    console?: number;
    /** 单个日志文件最大大小 (字节) @default 10485760 (10MB) */
    maxSize?: number;
}

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
    /** 禁用的钩子列表 */
    disableHooks?: string[];
    /** 禁用的插件列表 */
    disablePlugins?: string[];
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
    db?: DbHelper;

    /** Redis 助手 */
    redis?: RedisHelper;

    /** 日志器 */
    logger?: typeof Logger;

    /** 缓存助手 */
    cache?: CacheHelper;

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
    apiRoutes: Map<string, ApiRoute>;

    /** 插件列表 */
    pluginLists: Plugin[];

    /** 应用上下文 */
    appContext: KeyValue;

    /** 应用选项 */
    appOptions: BeflyOptions;

    /** 日志器 */
    logger: Logger;

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
export function createBefly(options?: BeflyOptions): Befly;
