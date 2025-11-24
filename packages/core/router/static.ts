/**
 * 静态文件路由处理器
 * 处理 /* 路径的静态文件请求
 */

// 外部依赖
import { join } from 'pathe';

// 相对导入
import { projectDir } from '../paths.js';
import { Logger } from '../lib/logger.js';
import { setCorsOptions } from '../util.js';

// 类型导入
import type { CorsConfig } from '../types/befly.js';

/**
 * 静态文件处理器工厂
 * @param corsConfig - CORS 配置
 */
export function staticHandler(corsConfig: CorsConfig = {}) {
    return async (req: Request): Promise<Response> => {
        // 设置 CORS 响应头
        const corsHeaders = setCorsOptions(req, corsConfig);

        const url = new URL(req.url);
        const filePath = join(projectDir, 'public', url.pathname);

        try {
            // OPTIONS预检请求
            if (req.method === 'OPTIONS') {
                return new Response(null, {
                    status: 204,
                    headers: corsHeaders
                });
            }

            const file = Bun.file(filePath);
            if (await file.exists()) {
                return new Response(file, {
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream',
                        ...corsHeaders
                    }
                });
            } else {
                return Response.json(
                    { code: 1, msg: '文件未找到' },
                    {
                        status: 404,
                        headers: corsHeaders
                    }
                );
            }
        } catch (error: any) {
            // 记录详细的错误日志
            Logger.error('静态文件处理失败', error);

            // 根据错误类型返回不同的错误信息
            let errorMessage = '文件读取失败';
            let errorDetail = {};

            return Response.json(
                { code: 1, msg: errorMessage, data: errorDetail },
                {
                    status: 500,
                    headers: corsHeaders
                }
            );
        }
    };
}
