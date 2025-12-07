// 相对导入
import { Logger } from '../lib/logger.js';

// 类型导入
import type { Hook } from '../types/hook.js';

/** 单个字段最大记录长度（字符数） */
const MAX_FIELD_LENGTH = 500;

/**
 * 截断单个值
 */
function truncateValue(value: any): any {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === 'string') {
        if (value.length > MAX_FIELD_LENGTH) {
            return value.substring(0, MAX_FIELD_LENGTH) + `... [truncated, total ${value.length} chars]`;
        }
        return value;
    }

    if (Array.isArray(value)) {
        const str = JSON.stringify(value);
        if (str.length > MAX_FIELD_LENGTH) {
            return `[Array, ${value.length} items, ${str.length} chars]`;
        }
        return value;
    }

    if (typeof value === 'object') {
        const str = JSON.stringify(value);
        if (str.length > MAX_FIELD_LENGTH) {
            return `[Object, ${Object.keys(value).length} keys, ${str.length} chars]`;
        }
        return value;
    }

    return value;
}

/**
 * 截断 body 对象的每个字段
 */
function truncateBody(body: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key in body) {
        result[key] = truncateValue(body[key]);
    }
    return result;
}

/**
 * 请求日志钩子
 * 在认证和解析之后记录完整的请求日志
 * order: 5 (在 parser 之后、validator 之前)
 */
const hook: Hook = {
    order: 5,
    handler: async (befly, ctx) => {
        // 只记录有效的 API 请求
        if (!ctx.api) return;

        const logData: Record<string, any> = {
            requestId: ctx.requestId,
            route: ctx.route,
            ip: ctx.ip,
            userId: ctx.user?.id || '',
            nickname: ctx.user?.nickname || '',
            roleCode: ctx.user?.roleCode || '',
            roleType: ctx.user?.roleType || ''
        };

        // 截断大请求体
        if (ctx.body && Object.keys(ctx.body).length > 0) {
            logData.body = truncateBody(ctx.body);
        }

        Logger.info(logData, '请求日志');
    }
};
export default hook;
