/**
 * 根路径路由处理器
 * 处理 / 路径的请求
 */

import { Env } from '../config/env.js';
import { setCorsOptions } from '../middleware/cors.js';

/**
 * 根路径处理器
 */
export async function rootHandler(req: Request): Promise<Response> {
    const corsOptions = setCorsOptions(req);
    return Response.json(
        {
            code: 0,
            msg: 'Befly 接口服务已启动',
            data: {
                mode: Env.NODE_ENV
            }
        },
        {
            headers: corsOptions.headers
        }
    );
}
