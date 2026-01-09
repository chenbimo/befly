/**
 * API 加载器
 * 负责扫描和加载所有 API 路由（组件、项目）
 */

// 类型导入
import type { ApiRoute } from "../types/api";
import type { ScanFileResult } from "../utils/scanFiles";

import { Logger } from "../lib/logger";

/**
 * 加载所有 API 路由
 * @param apiItems - scanSources/scanFiles 扫描到的 API 条目数组
 * @returns API 路由映射表
 */
export async function loadApis(apis: ScanFileResult[]): Promise<Map<string, ApiRoute>> {
    const apisMap = new Map<string, ApiRoute>();

    for (const api of apis) {
        // 兼容：scanFiles 的结果或测试构造数据可能缺少 type 字段；缺少时默认按 API 处理。
        // 仅在 type 显式存在且不等于 "api" 时跳过，避免错误过滤。
        if (Object.hasOwn(api, "type") && api.type !== "api") {
            continue;
        }

        try {
            const record = api as Record<string, unknown>;

            const path = record["path"];
            if (typeof path !== "string" || path.trim() === "") {
                continue;
            }

            const name = record["name"];
            if (typeof name !== "string" || name.trim() === "") {
                continue;
            }

            const handler = record["handler"];
            if (typeof handler !== "function") {
                continue;
            }

            const route: ApiRoute = {
                name: name,
                handler: handler as ApiRoute["handler"]
            };

            const method = record["method"];
            if (method === "GET" || method === "POST" || method === "GET,POST") {
                route.method = method;
            }

            const auth = record["auth"];
            if (typeof auth === "boolean") {
                route.auth = auth;
            }

            const fields = record["fields"];
            if (fields && typeof fields === "object") {
                route.fields = fields as NonNullable<ApiRoute["fields"]>;
            }

            const required = record["required"];
            if (Array.isArray(required) && required.every((v) => typeof v === "string")) {
                route.required = required;
            }

            const rawBody = record["rawBody"];
            if (typeof rawBody === "boolean") {
                route.rawBody = rawBody;
            }

            route.route = path;

            apisMap.set(path, route);
        } catch (error: unknown) {
            Logger.error({ err: error, api: api.relativePath, file: api.filePath, msg: "接口加载失败" });
            throw error;
        }
    }

    return apisMap;
}
