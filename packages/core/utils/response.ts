import type { RequestContext } from "../types/context.js";

import { Logger } from "../lib/logger.js";

/**
 * 创建错误响应（专用于 Hook 中间件）
 * 在钩子中提前拦截请求时使用
 * @param ctx - 请求上下文
 * @param msg - 错误消息
 * @param code - 错误码，默认 1
 * @param data - 附加数据，默认 null
 * @param detail - 详细信息，用于标记具体提示位置，默认 null
 * @param reasonCode - 拦截原因标识（用于统计/聚合），默认 null
 * @returns Response 对象
 */
export function ErrorResponse(ctx: RequestContext, msg: string, code: number = 1, data: any = null, detail: any = null, reasonCode: string | null = null): Response {
    // 记录拦截日志
    if (ctx.requestId) {
        // requestId/route/user/duration 等字段由 ALS 统一注入，避免在 msg 中重复拼接
        Logger.info(
            {
                event: "request_blocked",
                reason: msg,
                reasonCode: reasonCode,
                code: code,
                detail: detail
            },
            "request blocked"
        );
    }

    return Response.json(
        {
            code: code,
            msg: msg,
            data: data,
            detail: detail
        },
        {
            headers: ctx.corsHeaders
        }
    );
}

/**
 * 创建最终响应（专用于 API 路由结尾）
 * 自动处理 ctx.response/ctx.result，并记录请求日志
 * @param ctx - 请求上下文
 * @returns Response 对象
 */
export function FinalResponse(ctx: RequestContext): Response {
    // 记录请求日志
    if (ctx.api && ctx.requestId) {
        // requestId/route/user/duration 等字段由 ALS 统一注入，避免在 msg 中重复拼接
        Logger.info(
            {
                event: "request_done"
            },
            "request done"
        );
    }

    // 1. 如果已经有 response，直接返回
    if (ctx.response) {
        return ctx.response;
    }

    // 2. 如果有 result，格式化为响应
    if (ctx.result !== undefined) {
        let result = ctx.result;

        // 如果是字符串，自动包裹为成功响应
        if (typeof result === "string") {
            result = {
                code: 0,
                msg: result
            };
        }
        // 如果是对象，自动补充 code: 0
        else if (result && typeof result === "object") {
            if (!("code" in result)) {
                result = {
                    code: 0,
                    ...result
                };
            }
        }

        // 处理 BigInt 序列化问题
        if (result && typeof result === "object") {
            const jsonString = JSON.stringify(result, (key, value) => (typeof value === "bigint" ? value.toString() : value));
            return new Response(jsonString, {
                headers: {
                    ...ctx.corsHeaders,
                    "Content-Type": "application/json"
                }
            });
        } else {
            return Response.json(result, {
                headers: ctx.corsHeaders
            });
        }
    }

    // 3. 默认响应：没有生成响应
    return Response.json(
        {
            code: 1,
            msg: "未生成响应"
        },
        {
            headers: ctx.corsHeaders
        }
    );
}
