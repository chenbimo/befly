/**
 * 参数解析中间件
 * 解析不同类型的请求参数
 */

import { Logger } from '../utils/logger.js';
import { Xml } from '../utils/xml.js';
import { pickFields, isEmptyObject } from '../utils/index.js';
import type { ApiRoute } from '../types/api.js';

export interface ParseContext {
    body: any;
}

/**
 * 解析GET请求参数
 */
export function parseGetParams(req: Request, api: ApiRoute, ctx: ParseContext): void {
    const url = new URL(req.url);

    if (isEmptyObject(api.fields) === false) {
        ctx.body = pickFields(Object.fromEntries(url.searchParams), Object.keys(api.fields));
    } else {
        ctx.body = Object.fromEntries(url.searchParams);
    }
}

/**
 * 解析POST请求参数
 */
export async function parsePostParams(req: Request, api: ApiRoute, ctx: ParseContext): Promise<boolean> {
    try {
        const contentType = req.headers.get('content-type') || '';

        if (contentType.indexOf('json') !== -1) {
            ctx.body = await req.json();
        } else if (contentType.indexOf('xml') !== -1) {
            const textData = await req.text();
            const xmlData = Xml.parse(textData);
            ctx.body = xmlData?.xml ? xmlData.xml : xmlData;
        } else if (contentType.indexOf('form-data') !== -1) {
            ctx.body = await req.formData();
        } else if (contentType.indexOf('x-www-form-urlencoded') !== -1) {
            const text = await req.text();
            const formData = new URLSearchParams(text);
            ctx.body = Object.fromEntries(formData);
        } else {
            ctx.body = {};
        }

        if (isEmptyObject(api.fields) === false) {
            ctx.body = pickFields(ctx.body, Object.keys(api.fields));
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
