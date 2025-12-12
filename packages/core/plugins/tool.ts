/**
 * 工具插件
 * 提供常用的工具函数
 */

// 类型导入
import type { Plugin } from '../types/plugin.js';
import type { RequestContext } from '../types/context.js';

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
 * 原始响应（用于第三方回调等场景）
 * @param ctx - 请求上下文
 * @param data - 响应数据对象
 * @param status - HTTP 状态码（可选，默认 200）
 * @returns Response 对象
 */
export function Raw(ctx: RequestContext, data: Record<string, any>, status: number = 200) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' }
    });
}

const plugin: Plugin = {
    handler: () => {
        return {
            Yes: Yes,
            No: No,
            Raw: Raw
        };
    }
};

export default plugin;
