import type { Hook } from '../types/hook.js';
import { isPlainObject, isEmpty } from 'es-toolkit/compat';
import { pickFields } from 'befly-util';
import { Xml } from '../lib/xml.js';
import { No } from '../utils/response.js';
import type { ApiRoute } from '../types/api.js';
import type { RequestContext } from '../types/context.js';

/**
 * 解析GET请求参数
 */
function parseGetParams(api: ApiRoute, ctx: RequestContext): void {
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
async function parsePostParams(api: ApiRoute, ctx: RequestContext): Promise<boolean> {
    const contentType = ctx.request.headers.get('content-type') || '';

    try {
        if (contentType.includes('application/json')) {
            const body = await ctx.request.json();
            if (isPlainObject(api.fields) && !isEmpty(api.fields)) {
                ctx.body = pickFields(body, Object.keys(api.fields));
            } else {
                ctx.body = body;
            }
            return true;
        } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
            const text = await ctx.request.text();
            const body = await Xml.parse(text);
            if (isPlainObject(api.fields) && !isEmpty(api.fields)) {
                ctx.body = pickFields(body, Object.keys(api.fields));
            } else {
                ctx.body = body;
            }
            return true;
        }
    } catch (e) {
        return false;
    }
    return false;
}

const hook: Hook = {
    after: ['auth'],
    handler: async (befly, ctx, next) => {
        if (!ctx.api) return next();

        if (ctx.request.method === 'GET') {
            parseGetParams(ctx.api, ctx);
        } else if (ctx.request.method === 'POST') {
            const parseSuccess = await parsePostParams(ctx.api, ctx);
            if (!parseSuccess) {
                ctx.response = Response.json(No('无效的请求参数格式'), {
                    headers: ctx.corsHeaders
                });
                return;
            }
        }
        await next();
    }
};
export default plugin;
