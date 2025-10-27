/**
 * 根路径路由处理器
 * 处理 / 路径的请求
 */

import { Env } from '../config/env.js';
import { setCorsOptions } from '../middleware/cors.js';
import { Logger } from '../util.js';
import { No } from '../util.js';

/**
 * 根路径处理器
 */
export async function rootHandler(req: Request): Promise<Response> {
    const corsOptions = setCorsOptions(req);

    try {
        return Response.json(
            {
                code: 0,
                msg: 'Befly 接口服务已启动',
                data: {
                    mode: Env.NODE_ENV,
                    timestamp: Date.now()
                }
            },
            {
                headers: corsOptions.headers
            }
        );
    } catch (error: any) {
        // 记录详细的错误日志
        Logger.warn('根路径处理失败', {
            请求方法: req.method,
            请求URL: req.url,
            错误类型: error.constructor?.name || 'Error',
            错误信息: error.message,
            错误堆栈: error.stack
        });

        // 根据错误类型返回不同的错误信息
        let errorMessage = '服务异常';
        let errorDetail = {};

        // 开发环境返回详细错误信息
        if (Env.NODE_ENV === 'development') {
            errorDetail = {
                type: error.constructor?.name || 'Error',
                message: error.message,
                stack: error.stack
            };
        }

        return Response.json(No(errorMessage, errorDetail), {
            status: 500,
            headers: corsOptions.headers
        });
    }
}
