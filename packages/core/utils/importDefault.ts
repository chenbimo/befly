/**
 * 动态导入模块并优先返回其 default 导出。
 *
 * - import() 报错：返回 defaultValue
 * - default 导出为 null/undefined：返回 defaultValue
 */
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

import { Logger } from "../lib/logger";
import { getTypeTag } from "./util";

function isWindowsAbsPath(file: string): boolean {
    // e.g. C:\a\b 或 C:/a/b
    return /^[a-zA-Z]:[\\/]/.test(file);
}

function toFileImportUrl(file: string): string {
    if (isAbsolute(file) || isWindowsAbsPath(file)) {
        return pathToFileURL(file).href;
    }
    return file;
}

export async function importDefault<T>(file: string, defaultValue: T): Promise<T> {
    try {
        const isJson = file.endsWith(".json");

        // 注意：Node ESM / Bun 对 JSON import 的行为不同。
        // 为保证一致性：json 一律走 import assertion。
        const mod = (isJson ? await import(toFileImportUrl(file), { with: { type: "json" } }) : await import(file)) as { default?: unknown } | null | undefined;
        const value = mod?.default;
        if (value === null || value === undefined) {
            return defaultValue;
        }

        // 额外保护：如果导入值的运行时类型与 defaultValue 不一致，则回退 defaultValue。
        // 这样调用方可以通过 defaultValue 的类型约束导入结果（例如 defaultValue 为 {} 时，数组/字符串等会被拒绝）。
        const expectedType = getTypeTag(defaultValue);
        const actualType = getTypeTag(value);
        if (expectedType !== actualType) {
            Logger.warn({ file: file, msg: "importDefault 导入类型与默认值不一致，已回退到默认值", expectedType: expectedType, actualType: actualType });
            return defaultValue;
        }
        return value as T;
    } catch (err: any) {
        Logger.warn({ err: err, file: file, msg: "importDefault 导入失败，已回退到默认值" });
        return defaultValue;
    }
}
