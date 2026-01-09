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
            apisMap.set((api as any).path, api as any as ApiRoute);
        } catch (error: any) {
            Logger.error({ err: error, api: api.relativePath, file: api.filePath, msg: "接口加载失败" });
            throw error;
        }
    }

    return apisMap;
}
