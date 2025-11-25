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
                msg: 'Befly 接口服务已启动',
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

        return Response.json(
            {
                code: 1,
                msg: '服务异常',
                data: null
            },
            {
                headers: corsHeaders
            }
        );
    }
}
