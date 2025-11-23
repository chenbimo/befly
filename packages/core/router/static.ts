/**
 * 静态文件路由处理器
 * 处理 /* 路径的静态文件请求
 */

import { join } from 'pathe';
import { projectDir } from '../paths.js';
import { setCorsOptions } from '../lib/middleware.js';
import { Logger } from '../lib/logger.js';
import type { CorsConfig } from '../types/befly.js';

/**
 * 静态文件处理器工厂
 * @param corsConfig - CORS 配置
 */
export function staticHandler(corsConfig: CorsConfig = {}) {
    return async (req: Request): Promise<Response> => {
        const corsOptions = setCorsOptions(req, corsConfig);
        const url = new URL(req.url);
        const filePath = join(projectDir, 'public', url.pathname);

        try {
            // OPTIONS预检请求
            if (req.method === 'OPTIONS') {
                return new Response(null, {
                    status: 204,
                    headers: corsOptions.headers
                });
            }

            const file = Bun.file(filePath);
            if (await file.exists()) {
                return new Response(file, {
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream',
                        ...corsOptions.headers
                    }
                });
            } else {
                return Response.json(No('文件未找到'), {
                    status: 404,
                    headers: corsOptions.headers
                });
            }
        } catch (error: any) {
            // 记录详细的错误日志
            Logger.error('静态文件处理失败', error);

            // 根据错误类型返回不同的错误信息
            let errorMessage = '文件读取失败';
            let errorDetail = {};

            // 可以在这里根据 error.code 或 error.message 进行更细粒度的错误处理
            // 例如：权限不足、文件系统错误等

            return Response.json(
                { code: 1, msg: errorMessage, data: errorDetail },
                {
                    status: 500,
                    headers: corsOptions.headers
                }
            );
        }
    };
}

/**
 * 静态文件处理器
 */
export async function staticHandler(req: Request): Promise<Response> {
    const corsOptions = setCorsOptions(req);
    const url = new URL(req.url);
    const filePath = join(projectDir, 'public', url.pathname);

    try {
        // OPTIONS预检请求
        if (req.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsOptions.headers
            });
        }

        const file = Bun.file(filePath);
        if (await file.exists()) {
            return new Response(file, {
                headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                    ...corsOptions.headers
                }
            });
        } else {
            return Response.json(
                { code: 1, msg: '文件未找到' },
                {
                    status: 404,
                    headers: corsOptions.headers
                }
            );
        }
    } catch (error: any) {
        // 记录详细的错误日志
        Logger.error('静态文件处理失败', error);

        // 根据错误类型返回不同的错误信息
        let errorMessage = '文件读取失败';
        let errorDetail = {};

        // 权限错误
        if (error.message?.includes('EACCES') || error.message?.includes('permission')) {
            errorMessage = '文件访问权限不足';
        }
        // 路径错误
        else if (error.message?.includes('ENOENT') || error.message?.includes('not found')) {
            errorMessage = '文件路径不存在';
        }

        // 开发环境返回详细错误信息
        if (process.env.NODE_ENV === 'development') {
            errorDetail = {
                type: error.constructor?.name || 'Error',
                message: error.message,
                stack: error.stack,
                filePath: filePath
            };
        }

        return Response.json(
            { code: 1, msg: errorMessage, data: errorDetail },
            {
                status: 500,
                headers: corsOptions.headers
            }
        );
    }
}
