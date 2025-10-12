/**
 * Befly 核心框架类型定义
 */

import type { Plugin } from './plugin.js';
import type { ApiRoute, HttpMethod } from './api.js';
import type { KeyValue } from './common.js';
import type { Logger } from '../utils/logger.js';
import type { Jwt } from '../utils/jwt.js';
import type { Validator } from '../utils/validate.js';
import type { SqlHelper } from '../utils/sqlHelper.js';
import type { Crypto2 } from '../utils/crypto.js';
import type { Tool } from '../utils/tool.js';

/**
 * Befly 应用选项
 */
export interface BeflyOptions {
    /** 应用名称 */
    name?: string;

    /** 监听主机 */
    host?: string;

    /** 监听端口 */
    port?: number;

    /** 是否启用 CORS */
    cors?: boolean | CorsOptions;

    /** 静态文件目录 */
    staticDir?: string;

    /** 上传文件目录 */
    uploadDir?: string;

    /** 最大请求体大小 */
    maxBodySize?: number;

    /** 自定义配置 */
    [key: string]: any;
}

/**
 * CORS 配置选项
 */
export interface CorsOptions {
    origin?: string | string[] | boolean;
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
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
    sql: SqlHelper;

    /** 加密工具 */
    crypto: Crypto2;

    /** 通用工具 */
    tool: Tool;

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
     * 注册中间件
     */
    use(middleware: Function): void;

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
