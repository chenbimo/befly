/**
 * 根路径路由处理器
 * 处理 / 路径的请求
 */

// 相对导入
import { Logger } from '../lib/logger.js';
import { JsonResponse, setCorsOptions } from '../util.js';

/**
 * 根路径处理器
 */
export async function rootHandler(req: Request): Promise<Response> {
    // 设置 CORS 响应头
    const corsHeaders = setCorsOptions(req);

    try {
        return JsonResponse(
            'Befly 接口服务已启动',
            0,
            {
                mode: process.env.NODE_ENV || 'development',
                timestamp: Date.now()
            },
            corsHeaders
        );
    } catch (error: any) {
        // 记录详细的错误日志
        Logger.error('根路径处理失败', error);

        return JsonResponse('服务异常', 1, {}, corsHeaders);
    }
}
