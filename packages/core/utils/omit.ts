import { isPlainObject } from "./isPlainObject";

/**
 * 返回一个移除指定 key 的浅拷贝。
 * - 仅处理 plain object；其他类型返回空对象，避免日志场景抛错。
 */
export function omit<T extends Record<string, any>>(obj: unknown, keys: string[]): Partial<T> {
    if (!isPlainObject(obj)) {
        return {} as Partial<T>;
    }

    const keySet = new Set<string>(Array.isArray(keys) ? keys : []);
    const out: Record<string, any> = {};

    for (const [k, v] of Object.entries(obj)) {
        if (keySet.has(k)) {
            continue;
        }
        out[k] = v;
    }

    return out as Partial<T>;
}
