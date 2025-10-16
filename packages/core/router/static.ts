/**
 * 静态文件路由处理器
 * 处理 /* 路径的静态文件请求
 */

import path from 'node:path';
import { paths } from '../paths.js';
import { No } from '../utils/index.js';
import { setCorsOptions } from '../middleware/cors.js';
import { Logger } from '../utils/logger.js';
import { Env } from '../config/env.js';

/**
 * 静态文件处理器
 */
export async function staticHandler(req: Request): Promise<Response> {
    const corsOptions = setCorsOptions(req);
    const url = new URL(req.url);
    const filePath = path.join(paths.projectDir, 'public', url.pathname);

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
        Logger.error({
            msg: '静态文件处理失败',
            请求方法: req.method,
            请求URL: req.url,
            文件路径: filePath,
            错误类型: error.constructor?.name || 'Error',
            错误信息: error.message,
            错误堆栈: error.stack
        });

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
        if (Env.NODE_ENV === 'development') {
            errorDetail = {
                type: error.constructor?.name || 'Error',
                message: error.message,
                stack: error.stack,
                filePath: filePath
            };
        }

        return Response.json(No(errorMessage, errorDetail), {
            status: 500,
            headers: corsOptions.headers
        });
    }
}
