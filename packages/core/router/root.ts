/**
 * 根路径路由处理器
 * 处理 / 路径的请求
 */

// 相对导入
import { Logger } from '../lib/logger.js';
import { setCorsOptions } from '../util.js';

/**
 * 根路径处理器
 */
export async function rootHandler(req: Request): Promise<Response> {
    // 设置 CORS 响应头
    const corsHeaders = setCorsOptions(req);

    try {
        return Response.json(
            {
                code: 0,
                msg: `Befly 接口服务已启动`,
                data: {
                    mode: process.env.NODE_ENV || 'development',
                    timestamp: Date.now()
                }
            },
            {
                headers: corsHeaders
            }
        );
    } catch (error: any) {
        // 记录详细的错误日志
        Logger.error('根路径处理失败', error);

        // 根据错误类型返回不同的错误信息
        let errorMessage = '服务异常';
        let errorDetail = {};

        // 开发环境返回详细错误信息
        if (process.env.NODE_ENV === 'development') {
            errorDetail = {
                type: error.constructor?.name || 'Error',
                message: error.message,
                stack: error.stack
            };
        }

        return Response.json(
            { code: 1, msg: errorMessage, data: errorDetail },
            {
                status: 500,
                headers: corsHeaders
            }
        );
    }
}
