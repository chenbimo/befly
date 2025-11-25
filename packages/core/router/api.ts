/**
 * API路由处理器
 * 处理 /api/* 路径的请求
 */

// 相对导入
import { JsonResponse } from '../util.js';
import { Logger } from '../lib/logger.js';

// 类型导入
import type { RequestContext } from '../types/context.js';
import type { ApiRoute } from '../types/api.js';
import type { Hook } from '../types/hook.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * API处理器工厂函数
 * @param apiRoutes - API路由映射表
 * @param hookLists - 钩子列表
 * @param appContext - 应用上下文
 */
export function apiHandler(apiRoutes: Map<string, ApiRoute>, hookLists: Hook[], appContext: BeflyContext) {
    return async (req: Request): Promise<Response> => {
        // 1. 生成请求 ID
        const requestId = crypto.randomUUID();

        // 2. 创建请求上下文
        const url = new URL(req.url);
        const apiPath = `${req.method}${url.pathname}`;
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

        const ctx: RequestContext = {
            body: {},
            user: {},
            req: req,
            now: Date.now(),
            ip: clientIp,
            route: apiPath,
            requestId: requestId,
            corsHeaders: {
                'X-Request-ID': requestId
            },
            api: apiRoutes.get(apiPath),
            response: undefined,
            result: undefined
        };

        try {
            // 4. 串联执行所有钩子
            for (const hook of hookLists) {
                await hook.handler(appContext, ctx);

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
                            msg: '接口不存在',
                            data: null
                        },
                        {
                            headers: ctx.corsHeaders
                        }
                    );
                }
            } else if (ctx.api.handler) {
                const result = await ctx.api.handler(appContext, ctx);

                if (result instanceof Response) {
                    ctx.response = result;
                } else {
                    ctx.result = result;
                }
            }

            // 6. 返回响应（自动处理 response/result/日志）
            return JsonResponse(ctx);
        } catch (err: any) {
            // 全局错误处理
            const errorPath = ctx.api ? apiPath : req.url;
            Logger.error(`Request Error: ${errorPath}`, err);
            ctx.result = {
                code: 1,
                msg: '内部服务错误',
                data: null
            };
            return JsonResponse(ctx);
        }
    };
}
