/**
 * API路由处理器
 * 处理 /api/* 路径的请求
 */

import type { ApiRoute } from "../types/api";
import type { BeflyContext } from "../types/befly";
// 类型导入
import type { RequestContext } from "../types/context";
import type { Hook } from "../types/hook";

import { withCtx } from "../lib/asyncContext";
import { Logger } from "../lib/logger";
// 相对导入
import { getClientIp } from "../utils/getClientIp";
import { FinalResponse } from "../utils/response";
import { genShortId } from "../utils/util";

/**
 * API处理器工厂函数
 * @param apis - API路由映射表
 * @param hooks - 钩子列表
 * @param context - 应用上下文
 */
export function apiHandler(apis: Map<string, ApiRoute>, hooks: Hook[], context: BeflyContext) {
    return async (req: Request, server?: any): Promise<Response> => {
        // 1. 生成请求 ID
        const requestId = genShortId();

        // 2. 创建请求上下文
        const url = new URL(req.url);
        // 只用接口路径做存在性判断与匹配：不要把 method 拼进 key
        // 说明：apisMap 的 key 来源于 scanFiles/loadApis 生成的 path（例如 /api/core/xxx）
        const apiPath = url.pathname || "/";

        const clientIp = getClientIp(req, server);

        const now = Date.now();

        const ctx: RequestContext = {
            method: req.method,
            body: {},
            user: {},
            req: req,
            now: now,
            ip: clientIp,
            headers: req.headers,
            route: apiPath,
            requestId: requestId,
            corsHeaders: {
                "X-Request-ID": requestId
            },
            api: apis.get(apiPath),
            response: undefined,
            result: undefined
        };

        return withCtx(
            {
                requestId: requestId,
                method: req.method,
                route: apiPath,
                ip: clientIp,
                now: now
            },
            async () => {
                try {
                    // 4. 串联执行所有钩子
                    for (const hook of hooks) {
                        await hook.handler(context, ctx);

                        // 如果钩子已经设置了 response，停止执行
                        if (ctx.response) {
                            return ctx.response;
                        }
                    }

                    // hooks 全部通过后记录请求日志（拦截请求仅由 ErrorResponse 记录）
                    if (ctx.api && req.method !== "OPTIONS") {
                        const logData: Record<string, any> = {
                            event: "request",
                            apiName: ctx.api.name
                        };

                        if (ctx.body && Object.keys(ctx.body).length > 0) {
                            logData.body = ctx.body;
                        }

                        logData.msg = "request";
                        Logger.info(logData);
                    }

                    // 5. 执行 API handler
                    if (!ctx.api) {
                        if (req.method !== "OPTIONS") {
                            ctx.response = Response.json(
                                {
                                    code: 1,
                                    msg: "接口不存在"
                                },
                                {
                                    headers: ctx.corsHeaders
                                }
                            );
                        }
                    } else if (ctx.api.handler) {
                        const result = await ctx.api.handler(context, ctx);

                        if (result instanceof Response) {
                            ctx.response = result;
                        } else {
                            ctx.result = result;
                        }
                    }

                    // 7. 返回响应（自动处理 response/result/日志）
                    return FinalResponse(ctx);
                } catch (err: any) {
                    // 全局错误处理
                    const errorPath = ctx.api ? apiPath : req.url;
                    Logger.error({ err: err, path: errorPath, msg: "请求错误" });
                    ctx.result = {
                        code: 1,
                        msg: "内部服务错误"
                    };
                    return FinalResponse(ctx);
                }
            }
        );
    };
}
