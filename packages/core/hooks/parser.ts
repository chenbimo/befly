// 外部依赖
import { isPlainObject, isEmpty } from 'es-toolkit/compat';
import { pickFields } from 'befly-util';

// 相对导入
import { Xml } from '../lib/xml.js';
import { ErrorResponse } from '../util.js';

// 类型导入
import type { Hook } from '../types/hook.js';

/**
 * 请求参数解析钩子
 * - GET 请求：解析 URL 查询参数
 * - POST 请求：解析 JSON 或 XML 请求体
 * - 根据 API 定义的 fields 过滤字段
 */
const hook: Hook = {
    order: 4,
    handler: async (befly, ctx) => {
        if (!ctx.api) return;

        // GET 请求：解析查询参数
        if (ctx.req.method === 'GET') {
            const url = new URL(ctx.req.url);
            if (isPlainObject(ctx.api.fields) && !isEmpty(ctx.api.fields)) {
                ctx.body = pickFields(Object.fromEntries(url.searchParams), Object.keys(ctx.api.fields));
            } else {
                ctx.body = Object.fromEntries(url.searchParams);
            }
        } else if (ctx.req.method === 'POST') {
            // POST 请求：解析请求体
            const contentType = ctx.req.headers.get('content-type') || '';
            try {
                // JSON 格式
                if (contentType.includes('application/json')) {
                    const body = await ctx.req.json();
                    if (isPlainObject(ctx.api.fields) && !isEmpty(ctx.api.fields)) {
                        ctx.body = pickFields(body, Object.keys(ctx.api.fields));
                    } else {
                        ctx.body = body;
                    }
                } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
                    // XML 格式
                    const text = await ctx.req.text();
                    const body = await Xml.parse(text);
                    if (isPlainObject(ctx.api.fields) && !isEmpty(ctx.api.fields)) {
                        ctx.body = pickFields(body, Object.keys(ctx.api.fields));
                    } else {
                        ctx.body = body;
                    }
                } else {
                    // 不支持的 Content-Type
                    ctx.response = ErrorResponse(ctx, '无效的请求参数格式');
                    return;
                }
            } catch (e) {
                // 解析失败
                ctx.response = ErrorResponse(ctx, '无效的请求参数格式');
                return;
            }
        }
    }
};
export default hook;
