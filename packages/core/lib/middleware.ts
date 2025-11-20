/**
 * 中间件集合
 * 整合所有请求处理中间件
 */

import { isEmpty, isPlainObject } from 'es-toolkit/compat';
import { Env } from '../env.js';
import { Logger } from './logger.js';
import { Jwt } from './jwt.js';
import { Xml } from './xml.js';
import { Validator } from './validator.js';
import { pickFields } from 'befly-util';
import type { ApiRoute } from '../types/api.js';
import type { RequestContext } from '../types/context.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

// ========================================
// JWT 认证中间件
// ========================================

/**
 * 从请求头中提取并验证JWT token
 */
export async function authenticate(ctx: RequestContext): Promise<void> {
    const authHeader = ctx.request.headers.get('authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        try {
            const payload = await Jwt.verify(token);
            ctx.user = payload;
        } catch (error: any) {
            ctx.user = {};
        }
    } else {
        ctx.user = {};
    }
}

// ========================================
// CORS 中间件
// ========================================

export interface CorsResult {
    headers: Record<string, string>;
}

/**
 * 设置 CORS 选项
 * 根据环境变量或请求头动态设置跨域配置
 *
 * 注意：Access-Control-Allow-Origin 只能返回单个源，不能用逗号分隔多个源
 * 如果配置了多个允许的源，需要根据请求的 Origin 动态返回匹配的源
 *
 * @param req - 请求对象
 * @returns CORS 配置对象
 */
export const setCorsOptions = (req: Request): CorsResult => {
    return {
        headers: {
            'Access-Control-Allow-Origin': Env.CORS_ALLOWED_ORIGIN === '*' ? req.headers.get('origin') : Env.CORS_ALLOWED_ORIGIN,
            'Access-Control-Allow-Methods': Env.CORS_ALLOWED_METHODS,
            'Access-Control-Allow-Headers': Env.CORS_ALLOWED_HEADERS,
            'Access-Control-Expose-Headers': Env.CORS_EXPOSE_HEADERS,
            'Access-Control-Max-Age': Env.CORS_MAX_AGE || 86400,
            'Access-Control-Allow-Credentials': Env.CORS_ALLOW_CREDENTIALS || 'true'
        }
    };
};

/**
 * 处理OPTIONS预检请求
 * @param corsOptions - CORS 配置对象
 * @returns 204 响应
 */
export function handleOptionsRequest(corsOptions: CorsResult): Response {
    return new Response(null, {
        status: 204,
        headers: corsOptions.headers
    });
}

// ========================================
// 参数解析中间件
// ========================================

/**
 * 解析GET请求参数
 */
export function parseGetParams(api: ApiRoute, ctx: RequestContext): void {
    const url = new URL(ctx.request.url);

    if (isPlainObject(api.fields) && !isEmpty(api.fields)) {
        ctx.body = pickFields(Object.fromEntries(url.searchParams), Object.keys(api.fields));
    } else {
        ctx.body = Object.fromEntries(url.searchParams);
    }
}

/**
 * 解析POST请求参数
 */
export async function parsePostParams(api: ApiRoute, ctx: RequestContext): Promise<boolean> {
    try {
        const contentType = ctx.request.headers.get('content-type') || '';

        if (contentType.indexOf('json') !== -1) {
            try {
                ctx.body = await ctx.request.json();
            } catch (err) {
                // 如果没有 body 或 JSON 解析失败，默认为空对象
                ctx.body = {};
            }
        } else if (contentType.indexOf('xml') !== -1) {
            const textData = await ctx.request.text();
            const xmlData = Xml.parse(textData);
            ctx.body = xmlData?.xml ? xmlData.xml : xmlData;
        } else if (contentType.indexOf('form-data') !== -1) {
            ctx.body = await ctx.request.formData();
        } else if (contentType.indexOf('x-www-form-urlencoded') !== -1) {
            const text = await ctx.request.text();
            const formData = new URLSearchParams(text);
            ctx.body = Object.fromEntries(formData);
        } else {
            ctx.body = {};
        }

        if (isPlainObject(api.fields) && !isEmpty(api.fields)) {
            ctx.body = pickFields(ctx.body, Object.keys(api.fields));
        }

        return true;
    } catch (error: any) {
        Logger.error('处理请求参数时发生错误', error);
        return false;
    }
}

// ========================================
// 权限验证中间件
// ========================================

export interface PermissionResult {
    code: 0 | 1;
    msg: string;
    data: any;
    [key: string]: any;
}

/**
 * 检查权限
 *
 * 验证流程:
 * 1. auth=false → 公开接口，直接通过
 * 2. auth=true → 需要登录认证
 *    - 未登录 → 拒绝
 *    - roleCode='dev' → 超级管理员，拥有所有权限
 *    - 其他角色 → 检查接口是否在角色的可访问接口列表中（通过 Redis SISMEMBER 预判断）
 *
 * @param api - API 路由配置
 * @param ctx - 请求上下文
 * @param hasPermission - 是否有权限（通过 Redis SISMEMBER 预先判断）
 * @returns 统一的响应格式 { code: 0/1, msg, data, ...extra }
 */
export function checkPermission(api: ApiRoute, ctx: RequestContext, hasPermission: boolean = false): PermissionResult {
    // 1. 公开接口（auth=false），无需验证
    if (api.auth === false) {
        return { code: 0, msg: '', data: {} };
    }

    // 2. 需要登录的接口（auth=true）
    // 2.1 检查是否登录
    if (!ctx.user?.id) {
        return {
            code: 1,
            msg: '未登录',
            data: {},
            login: 'no'
        };
    }

    // 2.2 dev 角色拥有所有权限（超级管理员）
    if (ctx.user.roleCode === 'dev') {
        return { code: 0, msg: '', data: {} };
    }

    // 2.3 检查接口权限（基于 Redis SISMEMBER 预判断结果）
    if (!hasPermission) {
        return {
            code: 1,
            msg: '没有权限访问此接口',
            data: {}
        };
    }

    // 验证通过
    return { code: 0, msg: '', data: {} };
}

// ========================================
// 插件钩子中间件
// ========================================

/**
 * 执行所有插件的onGet钩子
 */
export async function executePluginHooks(pluginLists: Plugin[], appContext: BeflyContext, ctx: RequestContext): Promise<void> {
    for await (const plugin of pluginLists) {
        try {
            if (typeof plugin?.onGet === 'function') {
                await plugin?.onGet(appContext, ctx, ctx.request);
            }
        } catch (error: any) {
            Logger.error('插件处理请求时发生错误', error);
        }
    }
}

// ========================================
// 请求日志中间件
// ========================================

/**
 * 过滤日志字段（内部函数）
 * 用于从请求体中排除敏感字段（如密码、令牌等）
 * @param body - 请求体对象
 * @param excludeFields - 要排除的字段名（逗号分隔）
 * @returns 过滤后的对象
 */
function filterLogFields(body: any, excludeFields: string = ''): any {
    if (!body || (!isPlainObject(body) && !Array.isArray(body))) return body;

    const fieldsArray = excludeFields
        .split(',')
        .map((field) => field.trim())
        .filter((field) => field.length > 0);

    const filtered: any = {};
    for (const [key, value] of Object.entries(body)) {
        if (!fieldsArray.includes(key)) {
            filtered[key] = value;
        }
    }
    return filtered;
}

/**
 * 记录请求日志
 */
export function logRequest(apiPath: string, ctx: RequestContext): void {
    Logger.info({
        msg: '通用接口日志',
        请求路径: apiPath,
        请求方法: ctx.request.method,
        用户信息: ctx.user,
        请求参数: filterLogFields(ctx.body, Env.LOG_EXCLUDE_FIELDS),
        耗时: Date.now() - ctx.startTime + 'ms'
    });
}

// ========================================
// 参数验证中间件
// ========================================

// 创建全局validator实例
const validator = new Validator();

/**
 * 验证请求参数
 */
export function validateParams(api: ApiRoute, ctx: RequestContext) {
    return validator.validate(ctx.body, api.fields, api.required);
}
