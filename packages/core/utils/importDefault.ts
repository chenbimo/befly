/**
 * 动态导入模块并优先返回其 default 导出。
 *
 * - import() 报错：返回 defaultValue
 * - default 导出为 null/undefined：返回 defaultValue
 */
import { Logger } from "../lib/logger";

export async function importDefault<T>(file: string, defaultValue: T): Promise<T> {
    try {
        const mod = (await import(file)) as { default?: unknown } | null | undefined;
        const value = mod?.default;
        if (value === null || value === undefined) {
            return defaultValue;
        }
        return value as T;
    } catch (err: any) {
        Logger.warn({ err: err, file: file, msg: "importDefault 导入失败，已回退到默认值" });
        return defaultValue;
    }
}
