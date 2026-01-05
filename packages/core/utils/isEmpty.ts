import { isPlainObject } from "./isPlainObject";

/**
 * 激进空值判断（项目约定）：
 * - null/undefined => empty
 * - "" / 全空白字符串 => empty
 * - 0 / NaN => empty
 * - false => empty
 * - Array => length === 0
 * - Map/Set => size === 0
 * - plain object => 无自有 key
 * - 其他类型 => false
 */
export function isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) {
        return true;
    }

    if (typeof value === "string") {
        return value.trim().length === 0;
    }

    if (typeof value === "number") {
        return value === 0 || Number.isNaN(value);
    }

    if (typeof value === "boolean") {
        return value === false;
    }

    if (Array.isArray(value)) {
        return value.length === 0;
    }

    if (value instanceof Map || value instanceof Set) {
        return value.size === 0;
    }

    if (isPlainObject(value)) {
        return Object.keys(value).length === 0;
    }

    return false;
}
