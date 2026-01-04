/**
 * 静态文件路由处理器
 * 处理 /* 路径的静态文件请求
 */

// 类型导入
import type { CorsConfig } from "../types/befly.ts";

// 外部依赖
import { join } from "pathe";

import { Logger } from "../lib/logger.ts";
// 相对导入
import { appDir } from "../paths.ts";
import { setCorsOptions } from "../utils/cors.ts";

/**
 * 静态文件处理器工厂
 */
export function staticHandler(corsConfig: CorsConfig | undefined = undefined) {
    return async (req: Request): Promise<Response> => {
        // 设置 CORS 响应头
        const corsHeaders = setCorsOptions(req, corsConfig);

        const url = new URL(req.url);
        const filePath = join(appDir, "public", url.pathname);

        try {
            // OPTIONS预检请求
            if (req.method === "OPTIONS") {
                return new Response(null, {
                    status: 204,
                    headers: corsHeaders
                });
            }

            const file = Bun.file(filePath);
            if (await file.exists()) {
                return new Response(file, {
                    headers: {
                        "Content-Type": file.type || "application/octet-stream",
                        ...corsHeaders
                    }
                });
            } else {
                return Response.json(
                    {
                        code: 1,
                        msg: "文件未找到"
                    },
                    {
                        headers: corsHeaders
                    }
                );
            }
        } catch (error: any) {
            Logger.error({ err: error }, "静态文件处理失败");

            return Response.json(
                {
                    code: 1,
                    msg: "文件读取失败"
                },
                {
                    headers: corsHeaders
                }
            );
        }
    };
}
