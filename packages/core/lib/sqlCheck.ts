/**
 * SQL 入参校验工具（静态类）
 *
 * 目标：把“参数合法性/一致性/安全性”判断从 SqlBuilder 等拼接逻辑中拆出来，便于复用与维护。
 *
 * 说明：这里的校验仅关注“字符串/标识符/批量数据结构”层面的正确性；
 * 具体 SQL 语义（如字段是否存在）不在此处校验。
 */

export class SqlCheck {
    private static readonly SAFE_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

    static assertNonEmptyString(value: unknown, label: string): asserts value is string {
        if (typeof value !== "string") {
            throw new Error(`${label} 必须是字符串 (value: ${String(value)})`);
        }
        if (!value.trim()) {
            throw new Error(`${label} 不能为空`);
        }
    }

    static assertNoUndefinedParam(value: unknown, label: string): void {
        if (value === undefined) {
            throw new Error(`${label} 不能为 undefined`);
        }
    }

    static startsWithQuote(value: string): boolean {
        const trimmed = value.trim();
        return trimmed.startsWith("`") || trimmed.startsWith('"');
    }

    static isQuotedIdentPaired(value: string): boolean {
        const trimmed = value.trim();
        if (trimmed.length < 2) return false;

        const first = trimmed[0];
        const last = trimmed[trimmed.length - 1];

        if (first === "`" && last === "`") return true;
        if (first === '"' && last === '"') return true;

        return false;
    }

    static assertPairedQuotedIdentIfStartsWithQuote(value: string, label: string): void {
        if (SqlCheck.startsWithQuote(value) && !SqlCheck.isQuotedIdentPaired(value)) {
            throw new Error(`${label} 引用不完整，请使用成对的 \`...\` 或 "..." (value: ${value})`);
        }
    }

    static assertSafeIdentifierPart(part: string, kind: "table" | "schema" | "alias" | "field"): void {
        // 这里仅允许常规标识符（字母/数字/下划线），避免把复杂表达式混进“自动转义”路径。
        if (!SqlCheck.SAFE_IDENTIFIER_RE.test(part)) {
            throw new Error(`无效的 ${kind} 标识符: ${part}`);
        }
    }

    static assertSafeAlias(aliasPart: string): void {
        // alias 允许两种：
        // 1) 已经被引用（`alias` 或 "alias"）
        // 2) 普通标识符（不允许带空格/符号），避免注入
        if (SqlCheck.isQuotedIdentPaired(aliasPart)) return;
        if (!SqlCheck.SAFE_IDENTIFIER_RE.test(aliasPart)) {
            throw new Error(`无效的字段别名: ${aliasPart}`);
        }
    }

    static assertNoExprField(field: string): void {
        if (typeof field !== "string") return;
        const trimmed = field.trim();
        if (!trimmed) return;

        // 收紧：包含函数/表达式（括号）不允许走自动转义路径
        // 这类表达式应显式使用 selectRaw/whereRaw 以避免误拼接和注入风险
        if (trimmed.includes("(") || trimmed.includes(")")) {
            throw new Error(`字段包含函数/表达式，请使用 selectRaw/whereRaw (field: ${trimmed})`);
        }
    }

    static assertNoUndefinedInRecord(row: Record<string, unknown>, label: string): void {
        for (const [key, value] of Object.entries(row)) {
            if (value === undefined) {
                throw new Error(`${label} 存在 undefined 字段值 (field: ${key})`);
            }
        }
    }

    static assertBatchInsertRowsConsistent(rows: Array<Record<string, unknown>>, options: { table: string }): string[] {
        if (!Array.isArray(rows)) {
            throw new Error("批量插入 rows 必须是数组");
        }
        if (rows.length === 0) {
            throw new Error(`插入数据不能为空 (table: ${options.table})`);
        }

        const first = rows[0];
        if (!first || typeof first !== "object" || Array.isArray(first)) {
            throw new Error(`批量插入的每一行必须是对象 (table: ${options.table}, rowIndex: 0)`);
        }

        const fields = Object.keys(first);
        if (fields.length === 0) {
            throw new Error(`插入数据必须至少有一个字段 (table: ${options.table})`);
        }

        const fieldSet = new Set(fields);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || typeof row !== "object" || Array.isArray(row)) {
                throw new Error(`批量插入的每一行必须是对象 (table: ${options.table}, rowIndex: ${i})`);
            }

            const rowKeys = Object.keys(row);
            if (rowKeys.length !== fields.length) {
                throw new Error(`批量插入每行字段必须一致 (table: ${options.table}, rowIndex: ${i})`);
            }

            for (const key of rowKeys) {
                if (!fieldSet.has(key)) {
                    throw new Error(`批量插入每行字段必须一致 (table: ${options.table}, rowIndex: ${i}, extraField: ${key})`);
                }
            }

            for (const field of fields) {
                if (!(field in row)) {
                    throw new Error(`批量插入缺少字段 (table: ${options.table}, rowIndex: ${i}, field: ${field})`);
                }
                SqlCheck.assertNoUndefinedParam((row as any)[field], `批量插入字段值 (table: ${options.table}, rowIndex: ${i}, field: ${field})`);
            }
        }

        return fields;
    }
}
