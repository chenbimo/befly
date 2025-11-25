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
                    ctx.response = JsonResponse(ctx, '接口不存在');
                }
            } else if (ctx.api.handler) {
                const result = await ctx.api.handler(appContext, ctx);

                if (result instanceof Response) {
                    ctx.response = result;
                } else {
                    ctx.result = result;
                }
            }

            // 6. 格式化 result 为 response
            if (!ctx.response && ctx.result !== undefined) {
                let result = ctx.result;

                // 如果是字符串，自动包裹为成功响应
                if (typeof result === 'string') {
                    result = {
                        code: 0,
                        msg: result,
                        data: {}
                    };
                }
                // 如果是对象，自动补充 code: 0
                else if (result && typeof result === 'object') {
                    if (!('code' in result)) {
                        result = {
                            code: 0,
                            ...result
                        };
                    }
                }

                // 处理 BigInt 序列化问题
                if (result && typeof result === 'object') {
                    const jsonString = JSON.stringify(result, (key, value) => (typeof value === 'bigint' ? value.toString() : value));
                    ctx.response = new Response(jsonString, {
                        headers: {
                            ...ctx.corsHeaders,
                            'Content-Type': 'application/json'
                        }
                    });
                } else {
                    // 简单类型直接返回
                    ctx.response = Response.json(result, {
                        headers: ctx.corsHeaders
                    });
                }
            }

            // 7. 记录请求日志
            if (ctx.api && ctx.requestId) {
                const duration = Date.now() - ctx.now;
                const user = ctx.user?.userId ? `[User:${ctx.user.userId}]` : '[Guest]';
                Logger.info(`[${ctx.requestId}] ${apiPath} ${user} ${duration}ms`);
            }

            // 8. 返回响应
            return ctx.response || JsonResponse(ctx, 'No response generated');
        } catch (err: any) {
            // 全局错误处理
            const errorPath = ctx.api ? apiPath : req.url;
            Logger.error(`Request Error: ${errorPath}`, err);
            return JsonResponse(ctx, '内部服务错误');
        }
    };
}
