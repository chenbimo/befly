/**
 * 静态文件路由处理器
 * 处理 /* 路径的静态文件请求
 */

import path from 'node:path';
import { paths } from '../paths.js';
import { No } from '../utils/index.js';
import { setCorsOptions } from '../middleware/cors.js';

/**
 * 静态文件处理器
 */
export async function staticHandler(req: Request): Promise<Response> {
    const corsOptions = setCorsOptions(req);

    // 直接返回options请求
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsOptions.headers
        });
    }

    const url = new URL(req.url);
    const filePath = path.join(paths.projectDir, 'public', url.pathname);

    try {
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
                headers: corsOptions.headers
            });
        }
    } catch (error: any) {
        return Response.json(No('文件读取失败'), {
            headers: corsOptions.headers
        });
    }
}
