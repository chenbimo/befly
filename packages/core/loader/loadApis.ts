/**
 * API 加载器
 * 负责扫描和加载所有 API 路由（组件、项目）
 */

// 类型导入
import type { ApiRoute } from "../types/api.js";
import type { ScanFileResult } from "../utils/scanFiles.js";

import { Logger } from "../lib/logger.js";
import { processFields } from "../utils/processFields.js";

/**
 * 加载所有 API 路由
 * @param apiItems - scanSources/scanFiles 扫描到的 API 条目数组
 * @returns API 路由映射表
 */
export async function loadApis(apis: ScanFileResult[]): Promise<Map<string, ApiRoute>> {
    const apisMap = new Map<string, ApiRoute>();

    for (const api of apis) {
        try {
            // 处理字段定义，将 @ 引用替换为实际字段定义
            api.fields = processFields(api.fields || {}, api.name, api.routePath);

            apisMap.set(api.routePath, api);
        } catch (error: any) {
            Logger.error({ err: error, api: apiFile.relativePath, file: apiFile.filePath }, "接口加载失败");
            throw error;
        }
    }

    return apisMap;
}
