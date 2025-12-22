/**
 * API 加载器
 * 负责扫描和加载所有 API 路由（组件、项目）
 */

// 类型导入
import type { ApiRoute } from "../types/api.js";
import type { ScanFileResult } from "../utils/scanFiles.js";

import { Logger } from "../lib/logger.js";
import { processFields } from "../utils/processFields.js";
import { makeRouteKey } from "../utils/route.js";

/**
 * 加载所有 API 路由
 * @param apiItems - scanSources/scanFiles 扫描到的 API 条目数组
 * @returns API 路由映射表
 */
export async function loadApis(apis: ScanFileResult[]): Promise<Map<string, ApiRoute>> {
    const apisMap = new Map<string, ApiRoute>();

    // 4. 遍历处理所有 API 文件
    for (const api of apis) {
        try {
            // 设置默认值

            // 构建路由路径（用于错误提示）
            const sourcePrefix = api.source === "core" ? "/core/" : api.source === "app" ? "/app/" : "/addon/";
            const routePath = `/api${sourcePrefix}${api.relativePath}`;

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

    return apisMap;
}
