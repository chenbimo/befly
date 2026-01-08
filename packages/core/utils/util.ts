/**
 * 注意：本文件用于集中维护 core 内部通用 utils。
 * - 按项目规范：避免零散小文件噪音；实现集中在本文件，而不是做 re-export 聚合。
 * - 仅在 packages/core 内部使用；core 对外不承诺这些路径导出。
 */

export function isPlainObject(value: unknown): value is Record<string, any> {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

export type ValueTypeTag = "undefined" | "null" | "string" | "number" | "boolean" | "bigint" | "symbol" | "function" | "array" | "object";

export function getTypeTag(value: unknown): ValueTypeTag {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return "array";

    const t = typeof value;
    if (t === "string") return "string";
    if (t === "number") return "number";
    if (t === "boolean") return "boolean";
    if (t === "bigint") return "bigint";
    if (t === "symbol") return "symbol";
    if (t === "function") return "function";

    return "object";
}

const REGEXP_SPECIAL = /[\\^$.*+?()[\]{}|]/g;

export function escapeRegExp(input: string): string {
    return String(input).replace(REGEXP_SPECIAL, "\\$&");
}

export function normalizePositiveInt(value: any, fallback: number, min: number, max: number): number {
    if (typeof value !== "number") return fallback;
    if (!Number.isFinite(value)) return fallback;
    const v = Math.floor(value);
    if (v < min) return fallback;
    if (v > max) return max;
    return v;
}

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

export function forOwn(obj: unknown, iteratee: (value: any, key: string) => void): void {
    if (typeof iteratee !== "function") {
        return;
    }

    if (!isPlainObject(obj)) {
        return;
    }

    for (const key of Object.keys(obj)) {
        iteratee((obj as any)[key], key);
    }
}

function toWordParts(input: string): string[] {
    const normalized = String(input)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim();

    if (normalized.length === 0) {
        return [];
    }

    return normalized.split(/\s+/).filter((p) => p.length > 0);
}

function upperFirst(s: string): string {
    if (s.length === 0) {
        return s;
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * 把字符串转为小驼峰。
 * - 主要用于文件名/目录名（例如 my_plugin / my-plugin / my plugin）。
 */
export function camelCase(input: string): string {
    const parts = toWordParts(input);
    if (parts.length === 0) {
        return "";
    }

    const firstPart = parts[0];
    if (!firstPart) {
        return "";
    }

    const first = firstPart.toLowerCase();
    const rest = parts.slice(1).map((p) => upperFirst(p.toLowerCase()));
    return [first].concat(rest).join("");
}

function normalizeToWords(input: string): string {
    return String(input)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim();
}

/**
 * 把字符串转为 snake_case。
 * - 主要用于表名/字段名（例如 userId -> user_id）。
 */
export function snakeCase(input: string): string {
    const normalized = normalizeToWords(input);
    if (normalized.length === 0) {
        return "";
    }

    return normalized
        .split(/\s+/)
        .filter((p) => p.length > 0)
        .map((p) => p.toLowerCase())
        .join("_");
}

/**
 * 对象字段名转小驼峰
 * @param obj - 源对象
 * @returns 字段名转为小驼峰格式的新对象
 *
 * @example
 * keysToCamel({ user_id: 123, user_name: 'John' }) // { userId: 123, userName: 'John' }
 * keysToCamel({ created_at: 1697452800000 }) // { createdAt: 1697452800000 }
 */
export const keysToCamel = <T = any>(obj: Record<string, any>): T => {
    if (!obj || !isPlainObject(obj)) return obj as T;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = camelCase(key);
        result[camelKey] = value;
    }
    return result;
};

/**
 * 对象字段名转下划线
 * @param obj - 源对象
 * @returns 字段名转为下划线格式的新对象
 *
 * @example
 * keysToSnake({ userId: 123, userName: 'John' }) // { user_id: 123, user_name: 'John' }
 * keysToSnake({ createdAt: 1697452800000 }) // { created_at: 1697452800000 }
 */
export const keysToSnake = <T = any>(obj: Record<string, any>): T => {
    if (!obj || !isPlainObject(obj)) return obj as T;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = snakeCase(key);
        result[snakeKey] = value;
    }
    return result;
};

/**
 * 数组对象字段名批量转小驼峰
 * @param arr - 源数组
 * @returns 字段名转为小驼峰格式的新数组
 *
 * @example
 * arrayKeysToCamel([
 *   { user_id: 1, user_name: 'John' },
 *   { user_id: 2, user_name: 'Jane' }
 * ])
 * // [{ userId: 1, userName: 'John' }, { userId: 2, userName: 'Jane' }]
 */
export const arrayKeysToCamel = <T = any>(arr: Record<string, any>[]): T[] => {
    if (!arr || !Array.isArray(arr)) return arr as T[];
    return arr.map((item) => keysToCamel<T>(item));
};

export function getByPath(obj: unknown, path: string): unknown {
    if (!path) {
        return obj;
    }

    const parts = path.split(".");
    let cur: any = obj;

    for (const part of parts) {
        if (cur === null || cur === undefined) {
            return undefined;
        }
        if (typeof cur !== "object") {
            return undefined;
        }
        cur = (cur as any)[part];
    }

    return cur;
}

export function setByPath(target: Record<string, any>, path: string, value: unknown): void {
    const parts = path.split(".");
    // 避免无效 path（如 a..b）导致部分写入
    for (const part of parts) {
        if (!part) {
            return;
        }
    }
    let cur: Record<string, any> = target;

    for (let i = 0; i < parts.length; i++) {
        const key = parts[i];
        if (!key) {
            return;
        }

        const isLast = i === parts.length - 1;
        if (isLast) {
            cur[key] = value;
            return;
        }

        const nextVal = cur[key];
        if (!isPlainObject(nextVal)) {
            cur[key] = {};
        }

        cur = cur[key] as Record<string, any>;
    }
}

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

/**
 * 挑选指定字段
 */
export const pickFields = <T extends Record<string, any>>(obj: T, keys: string[]): Partial<T> => {
    if (!obj || (!isPlainObject(obj) && !Array.isArray(obj))) {
        return {};
    }

    const result: any = {};
    for (const key of keys) {
        if (key in obj) {
            result[key] = (obj as any)[key];
        }
    }

    return result;
};

export function keyBy<T>(items: T[], getKey: (item: T) => string): Record<string, T> {
    const out: Record<string, T> = {};

    if (!Array.isArray(items) || typeof getKey !== "function") {
        return out;
    }

    for (const item of items) {
        const key = getKey(item);
        if (typeof key !== "string" || key === "") {
            continue;
        }
        out[key] = item;
    }

    return out;
}

/**
 * 生成短 ID
 * 由时间戳（base36）+ 随机字符组成，约 13 位
 * - 前 8 位：时间戳（可排序）
 * - 后 5 位：随机字符（防冲突）
 * @returns 短 ID 字符串
 * @example
 * genShortId() // "lxyz1a2b3c4"
 */
export function genShortId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
