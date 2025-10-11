/**
 * 中间件模块类型定义
 */

import type { ApiRoute } from './api.js';
import type { Plugin } from './plugin.js';
import type { BeflyContext } from './befly.js';

/**
 * CORS 结果
 */
export interface CorsResult {
    headers: Record<string, string>;
}

/**
 * 认证上下文
 */
export interface AuthContext {
    user: any;
}

/**
 * 解析上下文
 */
export interface ParseContext {
    body: any;
}

/**
 * 权限上下文
 */
export interface PermissionContext {
    user: any;
}

/**
 * 权限检查结果
 */
export interface PermissionResult {
    allowed: boolean;
    reason?: string;
    extra?: any;
}

/**
 * 验证上下文
 */
export interface ValidateContext {
    body: any;
}

/**
 * 钩子上下文
 */
export interface HookContext {
    headers: Record<string, string>;
    body: any;
    user: any;
}

/**
 * 日志上下文
 */
export interface LogContext {
    user: any;
    body: any;
}

/**
 * CORS 中间件
 */
export interface CorsMiddleware {
    handleCors(req: Request): CorsResult;
    handleOptionsRequest(corsOptions: CorsResult): Response;
}

/**
 * 认证中间件
 */
export interface AuthMiddleware {
    authenticate(req: Request, ctx: AuthContext): Promise<void>;
}

/**
 * 解析中间件
 */
export interface ParserMiddleware {
    parseGetParams(req: Request, api: ApiRoute, ctx: ParseContext): void;
    parsePostParams(req: Request, api: ApiRoute, ctx: ParseContext): Promise<boolean>;
}

/**
 * 权限中间件
 */
export interface PermissionMiddleware {
    checkPermission(api: ApiRoute, ctx: PermissionContext): PermissionResult;
}

/**
 * 验证中间件
 */
export interface ValidatorMiddleware {
    validateParams(api: ApiRoute, ctx: ValidateContext): any;
}

/**
 * 插件钩子中间件
 */
export interface PluginHooksMiddleware {
    executePluginHooks(pluginLists: Plugin[], appContext: BeflyContext, ctx: HookContext, req: Request): Promise<void>;
}

/**
 * 请求日志中间件
 */
export interface RequestLoggerMiddleware {
    logRequest(apiPath: string, method: string, ctx: LogContext): void;
}
