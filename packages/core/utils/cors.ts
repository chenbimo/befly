import type { CorsConfig } from "../types/befly.js";

/**
 * 设置 CORS 响应头
 * @param req - 请求对象
 * @param config - CORS 配置（可选）
 * @returns CORS 响应头对象
 */
export function setCorsOptions(req: Request, config: CorsConfig = {}): Record<string, string> {
  const origin = config.origin || "*";
  return {
    "Access-Control-Allow-Origin": origin === "*" ? req.headers.get("origin") || "*" : origin,
    "Access-Control-Allow-Methods": config.methods || "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      config.allowedHeaders || "Content-Type, Authorization, authorization, token",
    "Access-Control-Expose-Headers":
      config.exposedHeaders ||
      "Content-Range, X-Content-Range, Authorization, authorization, token",
    "Access-Control-Max-Age": String(config.maxAge || 86400),
    "Access-Control-Allow-Credentials": config.credentials || "true",
  };
}
