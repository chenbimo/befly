/**
 * API路由处理器
 * 处理 /api/* 路径的请求
 */

import { Logger } from '../utils/logger.js';
import { No } from '../utils/index.js';
import { setCorsOptions, handleOptionsRequest } from '../middleware/cors.js';
import { Env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { parseGetParams, parsePostParams } from '../middleware/parser.js';
import { checkPermission } from '../middleware/permission.js';
import { validateParams } from '../middleware/validator.js';
import { executePluginHooks } from '../middleware/plugin-hooks.js';
import { logRequest } from '../middleware/request-logger.js';
import { RequestContext } from '../utils/requestContext.js';
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
        try {
            // 1. CORS处理
            const corsOptions = setCorsOptions(req);

            // OPTIONS预检请求
            if (req.method === 'OPTIONS') {
                return handleOptionsRequest(corsOptions);
            }

            // 2. 创建请求上下文
            const ctx = new RequestContext(req);

            // 3. 获取API路由
            const url = new URL(req.url);
            const apiPath = `${req.method}${url.pathname}`;
            const api = apiRoutes.get(apiPath);

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

            // 8. 权限验证
            const permissionResult = checkPermission(api, ctx);
            if (!permissionResult.allowed) {
                return Response.json(No(permissionResult.reason!, {}, permissionResult.extra), {
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
            const corsOptions = setCorsOptions(req);

            // 获取接口信息用于日志
            const url = new URL(req.url);
            const apiPath = `${req.method}${url.pathname}`;
            const api = apiRoutes.get(apiPath);

            Logger.error({
                msg: api ? `接口 [${api.name}] 执行失败` : '处理接口请求时发生错误',
                接口名称: api?.name || '未知',
                接口路径: apiPath,
                请求方法: req.method,
                请求URL: req.url,
                错误信息: error.message,
                错误堆栈: error.stack
            });

            // 开发环境返回详细错误信息
            const errorDetail =
                Env.NODE_ENV === 'development'
                    ? {
                          message: error.message,
                          stack: error.stack
                      }
                    : {};

            return Response.json(No('内部服务器错误', errorDetail), {
                headers: corsOptions.headers
            });
        }
    };
}
