import type { JsonValue, SqlValue } from "../types/common";

/**
 * SQL 通用工具函数（core 内部使用）。
 *
 * 约束：
 * - 只做字符串/参数/结果规范化（允许生成 SQL 字符串，但不执行 SQL）
 * - 尽量不依赖业务字段类型语义（array_* / FieldDefinition 等）
 */

/**
 * MySQL DDL 的 COMMENT \"...\" 字面量转义：仅转义双引号。
 * 说明：当前 SyncTable 使用双引号包裹 COMMENT 内容。
 */
export function escapeComment(str: string): string {
    return String(str).replace(/"/g, '\\"');
}

/**
 * 将 information_schema 返回的 COLUMN_DEFAULT 规整为可 JSON 表达的值。
 *
 * 说明：MySQL 驱动可能返回 string/number/null，也可能返回其他可转字符串的类型。
 */
export function normalizeColumnDefaultValue(value: unknown): JsonValue {
    if (value === null) return null;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) {
        const items: JsonValue[] = [];
        for (const v of value) {
            items.push(normalizeColumnDefaultValue(v));
        }
        return items;
    }
    return String(value);
}

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
            if (v === undefined) return false;
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

function tryNormalizeJsonValue(value: unknown): JsonValue | null {
    if (isJsonPrimitive(value)) return value;

    if (Array.isArray(value)) {
        const out: JsonValue[] = [];
        for (const item of value) {
            const normalized = tryNormalizeJsonValue(item);
            if (normalized === null) return null;
            out.push(normalized);
        }
        return out;
    }

    if (isJsonObject(value)) {
        const out: Record<string, JsonValue> = {};
        for (const [k, v] of Object.entries(value)) {
            if (v === undefined) continue;
            const normalized = tryNormalizeJsonValue(v);
            if (normalized === null) return null;
            out[k] = normalized;
        }
        return out;
    }

    return null;
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

        const normalizedJson = tryNormalizeJsonValue(value);
        if (normalizedJson !== null) {
            // JsonObject / JsonValue[] 都属于 SqlValue 允许的范围
            out.push(normalizedJson);
            continue;
        }

        out.push(String(value));
    }

    return out;
}

export type SqlRunResult = {
    changes?: number | bigint;
    lastInsertRowid?: number | bigint;
};

export function toNumberFromSql(value: unknown): number {
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return Number(value);
    return 0;
}
