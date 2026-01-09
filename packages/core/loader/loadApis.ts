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
        try {
            // B 方案：信任启动期 checkApi 的结构校验，这里只负责把 scanFiles 的结果映射为运行时 ApiRoute。
            // 仍然兼容测试构造数据：缺少 type 时默认按 api 处理；只有 type 显式存在且不为 api 才跳过。
            if (Object.hasOwn(api, "type") && api.type !== "api") {
                continue;
            }

            const record = api as Record<string, unknown>;

            const path = record["path"] as string;
            const route: ApiRoute = {
                name: record["name"] as string,
                handler: record["handler"] as ApiRoute["handler"],
                route: path
            };

            const method = record["method"];
            if (method !== undefined) {
                route.method = method as NonNullable<ApiRoute["method"]>;
            }

            const auth = record["auth"];
            if (auth !== undefined) {
                route.auth = auth as NonNullable<ApiRoute["auth"]>;
            }

            const fields = record["fields"];
            if (fields !== undefined) {
                route.fields = fields as NonNullable<ApiRoute["fields"]>;
            }

            const required = record["required"];
            if (required !== undefined) {
                route.required = required as NonNullable<ApiRoute["required"]>;
            }

            const rawBody = record["rawBody"];
            if (rawBody !== undefined) {
                route.rawBody = rawBody as NonNullable<ApiRoute["rawBody"]>;
            }

            apisMap.set(path, route);
        } catch (error: unknown) {
            Logger.error({ err: error, api: api.relativePath, file: api.filePath, msg: "接口加载失败" });
            throw error;
        }
    }

    return apisMap;
}
