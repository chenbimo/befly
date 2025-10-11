/**
 * 请求日志中间件
 * 记录API请求信息
 */

import { Logger } from '../utils/logger.js';
import { Env } from '../config/env.js';
import { filterLogFields } from '../utils/index.js';

export interface LogContext {
    user: any;
    body: any;
}

/**
 * 记录请求日志
 */
export function logRequest(apiPath: string, method: string, ctx: LogContext): void {
    Logger.info({
        msg: '通用接口日志',
        请求路径: apiPath,
        请求方法: method,
        用户信息: ctx.user,
        请求体: filterLogFields(ctx.body, Env.LOG_EXCLUDE_FIELDS)
    });
}
