/**
 * 请求日志中间件
 * 记录API请求信息
 */

import { Logger } from '../utils/logger.js';
import { Env } from '../config/env.js';
import { isType } from '../utils/helpers.js';
import type { RequestContext } from '../types/context.js';

/**
 * 过滤日志字段（内部函数）
 * 用于从请求体中排除敏感字段（如密码、令牌等）
 * @param body - 请求体对象
 * @param excludeFields - 要排除的字段名（逗号分隔）
 * @returns 过滤后的对象
 */
function filterLogFields(body: any, excludeFields: string = ''): any {
    if (!body || (!isType(body, 'object') && !isType(body, 'array'))) return body;

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
        请求方法: ctx.method,
        用户信息: ctx.user,
        请求参数: filterLogFields(ctx.body, Env.LOG_EXCLUDE_FIELDS),
        耗时: ctx.getElapsedTime() + 'ms'
    });
}
