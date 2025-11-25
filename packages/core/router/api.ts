/**
 * API路由处理器
 * 处理 /api/* 路径的请求
 */

// 相对导入
import { compose, JsonResponse } from '../util.js';

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
    // 提取所有钩子的处理函数
    const middleware = hookLists.map((h) => h.handler);

    // 组合钩子链
    const fn = compose(middleware);

    return async (req: Request): Promise<Response> => {
        // 1. 创建请求上下文
        const url = new URL(req.url);
        const apiPath = `${req.method}${url.pathname}`;

        const ctx: RequestContext = {
            body: {},
            user: {},
            req: req,
            now: Date.now(),
            corsHeaders: {},
            ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown',
            route: apiPath
        };

        // 2. 获取API路由
        const api = apiRoutes.get(apiPath);

        // 注意：即使 api 不存在，也需要执行插件链（以便处理 CORS OPTIONS 请求或 404 响应）
        // 如果是 OPTIONS 请求，通常不需要 api 对象
        if (api) {
            ctx.api = api;
        }

        // 3. 执行插件链（洋葱模型）
        // 错误处理已由 errorHandler 插件接管
        await fn(appContext, ctx, async () => {
            // 核心执行器：执行 API handler
            // 如果没有找到 API 且没有被前面的插件拦截（如 CORS），则返回 404
            if (!ctx.api) {
                // 只有非 OPTIONS 请求才报 404（OPTIONS 请求通常由 cors 插件处理并返回）
                if (req.method !== 'OPTIONS') {
                    ctx.response = JsonResponse(ctx, '接口不存在');
                }
                return;
            }

            if (ctx.api.handler) {
                const result = await ctx.api.handler(appContext, ctx, req);

                if (result instanceof Response) {
                    ctx.response = result;
                } else {
                    // 将结果存入 ctx.result，由 responseFormatter 插件统一处理
                    ctx.result = result;
                }
            }
        });

        // 4. 返回响应
        if (ctx.response) {
            return ctx.response;
        }

        // 兜底响应（理论上不应执行到这里，responseFormatter 会处理）
        return JsonResponse(ctx, 'No response generated');
    };
}
