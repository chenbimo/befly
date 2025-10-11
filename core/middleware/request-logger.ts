/**
 * 请求日志中间件
 * 记录API请求信息
 */

import { Logger } from '../utils/logger.js';
import { Env } from '../config/env.js';
import { filterLogFields } from '../utils/index.js';
import type { RequestContext } from '../types/context.js';

/**
 * 记录请求日志
 */
export function logRequest(apiPath: string, ctx: RequestContext): void {
    Logger.info({
        msg: '通用接口日志',
        请求路径: apiPath,
        请求方法: ctx.method,
        用户信息: ctx.user,
        请求参数: filterLogFields(ctx.params, Env.LOG_EXCLUDE_FIELDS),
        耗时: ctx.getElapsedTime() + 'ms'
    });
}
