/**
 * API路由处理器
 * 处理 /api/* 路径的请求
 */

import { Logger } from '../lib/logger.js';
import { No } from '../response.js';
import { setCorsOptions, handleOptionsRequest, authenticate, parseGetParams, parsePostParams, checkPermission, validateParams, executePluginHooks, logRequest } from '../lib/middleware.js';
import { Env } from '../env.js';
import type { RequestContext } from '../types/context.js';
import type { ApiRoute } from '../types/api.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * API处理器工厂函数
 * @param apiRoutes - API路由映射表
 * @param pluginLists - 插件列表
 * @param appContext - 应用上下文
 */
export function apiHandler(apiRoutes: Map<string, ApiRoute>, pluginLists: Plugin[], appContext: BeflyContext) {
    return async (req: Request): Promise<Response> => {
        const corsOptions = setCorsOptions(req);
        let ctx: RequestContext | null = null;
        let api: ApiRoute | undefined;
        let apiPath = '';

        try {
            // 1. OPTIONS预检请求
            if (req.method === 'OPTIONS') {
                return handleOptionsRequest(corsOptions);
            }

            // 2. 创建请求上下文
            ctx = {
                body: {},
                user: {},
                request: req,
                startTime: Date.now()
            };

            // 3. 获取API路由
            const url = new URL(req.url);
            apiPath = `${req.method}${url.pathname}`;
            api = apiRoutes.get(apiPath);

            if (!api) {
                return Response.json(No('接口不存在'), {
                    headers: corsOptions.headers
                });
            }

            // 4. 用户认证
            await authenticate(ctx);

            // 5. 参数解析
            if (req.method === 'GET') {
                parseGetParams(api, ctx);
            } else if (req.method === 'POST') {
                const parseSuccess = await parsePostParams(api, ctx);
                if (!parseSuccess) {
                    return Response.json(No('无效的请求参数格式'), {
                        headers: corsOptions.headers
                    });
                }
            }

            // 6. 执行插件钩子
            await executePluginHooks(pluginLists, appContext, ctx);

            // 7. 记录请求日志
            logRequest(apiPath, ctx);

            // 8. 权限验证（使用 Redis Set SISMEMBER 直接判断，提升性能）
            let hasPermission = false;
            if (api.auth === true && ctx.user?.roleCode && ctx.user.roleCode !== 'dev') {
                // 使用 Redis SISMEMBER 直接判断接口是否在角色权限集合中（O(1)复杂度）
                const roleApisKey = `role:apis:${ctx.user.roleCode}`;
                const isMember = await appContext.redis.sismember(roleApisKey, apiPath);
                hasPermission = isMember === 1;
            }

            const permissionResult = checkPermission(api, ctx, hasPermission);
            if (permissionResult.code !== 0) {
                return Response.json(permissionResult, {
                    headers: corsOptions.headers
                });
            }

            // 9. 参数验证
            const validateResult = validateParams(api, ctx);
            if (validateResult.code !== 0) {
                return Response.json(No('无效的请求参数格式', validateResult.fields), {
                    headers: corsOptions.headers
                });
            }

            // 10. 执行API处理器
            const result = await api.handler(appContext, ctx, req);

            // 11. 返回响应
            // 🔥 新增：直接返回 Response 对象
            if (result instanceof Response) {
                return result;
            }

            // 12. 返回响应
            if (result && typeof result === 'object' && 'code' in result) {
                // 处理 BigInt 序列化问题
                const jsonString = JSON.stringify(result, (key, value) => (typeof value === 'bigint' ? value.toString() : value));
                return new Response(jsonString, {
                    headers: {
                        ...corsOptions.headers,
                        'Content-Type': 'application/json'
                    }
                });
            } else {
                return new Response(result, {
                    headers: corsOptions.headers
                });
            }
        } catch (error: any) {
            // 记录详细的错误日志
            Logger.error(api ? `接口 [${api.name}] 执行失败` : '处理接口请求时发生错误', error);

            return Response.json(No('内部服务器错误'), {
                headers: corsOptions.headers
            });
        }
    };
}
