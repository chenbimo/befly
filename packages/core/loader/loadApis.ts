/**
 * API 加载器
 * 负责扫描和加载所有 API 路由（组件、项目）
 */

// 类型导入
import type { ApiRoute } from "../types/api.js";
import type { ScanFileResult } from "../utils/scanFiles.js";

import { Logger } from "../lib/logger.js";
import { makeRouteKey } from "../utils/route.js";

/**
 * 预定义的默认字段
 */
const PRESET_FIELDS: Record<string, any> = {
    "@id": { name: "ID", type: "number", min: 1, max: null },
    "@page": { name: "页码", type: "number", min: 1, max: 9999, default: 1 },
    "@limit": { name: "每页数量", type: "number", min: 1, max: 100, default: 30 },
    "@keyword": { name: "关键词", type: "string", min: 0, max: 50 },
    "@state": { name: "状态", type: "number", regex: "^[0-2]$" }
};

/**
 * 处理字段定义：将 @ 符号引用替换为实际字段定义
 */
function processFields(fields: Record<string, any>, apiName: string, routePath: string): Record<string, any> {
    if (!fields || typeof fields !== "object") return fields;

    const processed: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
        if (typeof value === "string" && value.startsWith("@")) {
            if (PRESET_FIELDS[value]) {
                processed[key] = PRESET_FIELDS[value];
                continue;
            }

            const validKeys = Object.keys(PRESET_FIELDS).join(", ");
            throw new Error(`API [${apiName}] (${routePath}) 字段 [${key}] 引用了未定义的预设字段 "${value}"。可用的预设字段有: ${validKeys}`);
        }

        processed[key] = value;
    }

    return processed;
}

/**
 * 加载所有 API 路由
 * @param apiItems - scanSources/scanFiles 扫描到的 API 条目数组
 * @returns API 路由映射表
 */
export async function loadApis(apiItems: ScanFileResult[]): Promise<Map<string, ApiRoute>> {
    const apis = new Map<string, ApiRoute>();

    // 4. 遍历处理所有 API 文件
    for (const apiFile of apiItems) {
        try {
            const api = (apiFile as any)?.content || {};

            // 设置默认值
            const methodStr = (api.method || "POST").toUpperCase();
            const auth = api.auth !== undefined ? api.auth : true;

            // 构建路由路径（用于错误提示）
            const sourcePrefix = apiFile.source === "core" ? "/core/" : apiFile.source === "app" ? "/app/" : "/addon/";
            const routePath = `/api${sourcePrefix}${apiFile.relativePath}`;

            // 处理字段定义，将 @ 引用替换为实际字段定义
            const fields = processFields(api.fields || {}, api.name, routePath);
            const required = api.required || [];

            // 支持逗号分隔的多方法，拆分后分别注册
            const methods = methodStr
                .split(",")
                .map((m: string) => m.trim())
                .filter((m: string) => m);
            for (const method of methods) {
                const route = makeRouteKey(method, routePath);
                // 为每个方法创建独立的路由对象
                const routeApi: ApiRoute = {
                    name: api.name,
                    handler: api.handler,
                    method: method,
                    auth: auth,
                    fields: fields,
                    required: required,
                    rawBody: api.rawBody,
                    route: route
                };
                apis.set(route, routeApi);
            }
        } catch (error: any) {
            Logger.error({ err: error, api: apiFile.relativePath, file: apiFile.filePath }, "接口加载失败");
            throw error;
        }
    }

    return apis;
}
