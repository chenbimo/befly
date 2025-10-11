/**
 * 参数解析中间件
 * 解析不同类型的请求参数
 */

import { Logger } from '../utils/logger.js';
import { Xml } from '../utils/xml.js';
import { pickFields, isEmptyObject } from '../utils/index.js';
import type { ApiRoute } from '../types/api.js';
import type { RequestContext } from '../types/context.js';

/**
 * 解析GET请求参数
 */
export function parseGetParams(api: ApiRoute, ctx: RequestContext): void {
    const url = new URL(ctx.url);

    if (isEmptyObject(api.fields) === false) {
        ctx.params = pickFields(Object.fromEntries(url.searchParams), Object.keys(api.fields));
    } else {
        ctx.params = Object.fromEntries(url.searchParams);
    }
}

/**
 * 解析POST请求参数
 */
export async function parsePostParams(api: ApiRoute, ctx: RequestContext): Promise<boolean> {
    try {
        const contentType = ctx.contentType || '';

        if (contentType.indexOf('json') !== -1) {
            ctx.params = await ctx.request.json();
        } else if (contentType.indexOf('xml') !== -1) {
            const textData = await ctx.request.text();
            const xmlData = Xml.parse(textData);
            ctx.params = xmlData?.xml ? xmlData.xml : xmlData;
        } else if (contentType.indexOf('form-data') !== -1) {
            ctx.params = await ctx.request.formData();
        } else if (contentType.indexOf('x-www-form-urlencoded') !== -1) {
            const text = await ctx.request.text();
            const formData = new URLSearchParams(text);
            ctx.params = Object.fromEntries(formData);
        } else {
            ctx.params = {};
        }

        if (isEmptyObject(api.fields) === false) {
            ctx.params = pickFields(ctx.params, Object.keys(api.fields));
        }

        return true;
    } catch (err: any) {
        Logger.error({
            msg: '处理请求参数时发生错误',
            error: err.message,
            stack: err.stack
        });
        return false;
    }
}
