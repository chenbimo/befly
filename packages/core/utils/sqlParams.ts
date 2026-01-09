import type { JsonValue, SqlValue } from "../types/common";

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
    if (value === null) return true;
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== "object") return false;
    if (value instanceof Date) return false;
    if (Array.isArray(value)) return false;
    return true;
}

function isJsonValue(value: unknown): value is JsonValue {
    if (isJsonPrimitive(value)) return true;

    if (Array.isArray(value)) {
        for (const item of value) {
            if (!isJsonValue(item)) return false;
        }
        return true;
    }

    if (isJsonObject(value)) {
        for (const v of Object.values(value)) {
            if (v === undefined) continue;
            if (!isJsonValue(v)) return false;
        }
        return true;
    }

    return false;
}

export function isSqlValue(value: unknown): value is SqlValue {
    if (value instanceof Date) return true;
    return isJsonValue(value);
}

/**
 * 将外部输入参数（unknown[]）转换为 DbHelper/sqlInfo 可接受的 SqlValue[]。
 *
 * 规则：
 * - bigint -> string
 * - 其他不可序列化值 -> String(value)
 */
export function toSqlParams(params: unknown[] | undefined): SqlValue[] {
    if (!Array.isArray(params)) {
        return [];
    }

    const out: SqlValue[] = [];

    for (const value of params) {
        if (value === null) {
            out.push(null);
            continue;
        }

        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            out.push(value);
            continue;
        }

        if (typeof value === "bigint") {
            out.push(String(value));
            continue;
        }

        if (value instanceof Date) {
            out.push(value);
            continue;
        }

        if (isJsonValue(value)) {
            // JsonObject / JsonValue[] 都属于 SqlValue 允许的范围
            out.push(value);
            continue;
        }

        out.push(String(value));
    }

    return out;
}
