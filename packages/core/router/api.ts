/**
 * API路由处理器
 * 处理 /api/* 路径的请求
 */

// 相对导入
import { genShortId } from '../utils/genShortId.js';
import { FinalResponse } from '../utils/response.js';
import { makeRouteKey } from '../utils/route.js';
import { Logger } from '../lib/logger.js';

// 类型导入
import type { RequestContext } from '../types/context.js';
import type { ApiRoute } from '../types/api.js';
import type { Hook } from '../types/hook.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * API处理器工厂函数
 * @param apis - API路由映射表
 * @param hooks - 钩子列表
 * @param context - 应用上下文
 */
export function apiHandler(apis: Map<string, ApiRoute>, hooks: Hook[], context: BeflyContext) {
    return async (req: Request): Promise<Response> => {
        // 1. 生成请求 ID
        const requestId = genShortId();

        // 2. 创建请求上下文
        const url = new URL(req.url);
        const apiPath = makeRouteKey(req.method, url.pathname);
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

        const ctx: RequestContext = {
            method: req.method,
            body: {},
            user: {},
            req: req,
            now: Date.now(),
            ip: clientIp,
            headers: req.headers,
            route: apiPath,
            requestId: requestId,
            corsHeaders: {
                'X-Request-ID': requestId
            },
            api: apis.get(apiPath),
            response: undefined,
            result: undefined
        };

        try {
            // 4. 串联执行所有钩子
            for (const hook of hooks) {
                await hook.handler(context, ctx);

                // 如果钩子已经设置了 response，停止执行
                if (ctx.response) {
                    return ctx.response;
                }
            }

            // 5. 执行 API handler
            if (!ctx.api) {
                if (req.method !== 'OPTIONS') {
                    ctx.response = Response.json(
                        {
                            code: 1,
                            msg: '接口不存在'
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
            Logger.error({ err: err, path: errorPath }, '请求错误');
            ctx.result = {
                code: 1,
                msg: '内部服务错误'
            };
            return FinalResponse(ctx);
        }
    };
}
