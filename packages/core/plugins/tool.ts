/**
 * 工具插件
 * 提供常用的工具函数
 */

import type { RequestContext } from "../types/context";
import type { Plugin } from "../types/plugin";

/**
 * 成功响应
 * @param msg - 消息
 * @param data - 数据（可选）
 * @param other - 其他字段（可选）
 * @returns 成功响应对象
 */
export function Yes(msg: string, data: any = {}, other: Record<string, any> = {}) {
    return {
        code: 0,
        msg: msg,
        data: data,
        ...other
    };
}

/**
 * 失败响应
 * @param msg - 消息
 * @param data - 数据（可选）
 * @param other - 其他字段（可选）
 * @returns 失败响应对象
 */
export function No(msg: string, data: any = null, other: Record<string, any> = {}) {
    return {
        code: 1,
        msg: msg,
        data: data,
        ...other
    };
}

/**
 * 响应选项
 */
interface ResponseOptions {
    /** HTTP 状态码，默认 200 */
    status?: number;
    /** Content-Type，默认根据 data 类型自动判断 */
    contentType?: string;
    /** 额外的响应头 */
    headers?: Record<string, string>;
}

/**
 * 统一响应函数
 *
 * 自动识别数据类型并设置正确的 Content-Type：
 * - 对象 → application/json
 * - 字符串 → text/plain
 * - 可通过 options.contentType 手动指定
 *
 * @param ctx 请求上下文
 * @param data 响应数据（对象或字符串）
 * @param options 响应选项
 * @returns Response 对象
 *
 * @example
 * // JSON 响应（自动）
 * return Raw(ctx, { code: 'SUCCESS', message: '成功' });
 *
 * // 纯文本响应（自动）
 * return Raw(ctx, 'success');
 *
 * // XML 响应（手动指定）
 * return Raw(ctx, xmlString, { contentType: 'application/xml' });
 *
 * // 自定义状态码和额外头
 * return Raw(ctx, { error: 'Not Found' }, {
 *   status: 404,
 *   headers: { 'X-Custom': 'value' }
 * });
 */
export function Raw(ctx: RequestContext, data: Record<string, any> | string, options: ResponseOptions = {}): Response {
    const { status = 200, contentType, headers = {} } = options;

    // 自动判断 Content-Type
    let finalContentType = contentType;
    let body: string;

    if (typeof data === "string") {
        // 字符串类型
        body = data;
        if (!finalContentType) {
            // 自动判断：XML 或纯文本
            finalContentType = data.trim().startsWith("<") ? "application/xml" : "text/plain";
        }
    } else {
        // 对象类型，JSON 序列化
        body = JSON.stringify(data);
        finalContentType = finalContentType || "application/json";
    }

    // 合并响应头
    const responseHeaders = {
        ...ctx.corsHeaders,
        "Content-Type": finalContentType,
        ...headers
    };

    return new Response(body, {
        status: status,
        headers: responseHeaders
    });
}

const toolPlugin: Plugin = {
    name: "tool",
    enable: true,
    deps: [],
    handler: () => {
        return {
            Yes: Yes,
            No: No,
            Raw: Raw
        };
    }
};

export default toolPlugin;
