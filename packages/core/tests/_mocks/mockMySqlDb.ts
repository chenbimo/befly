import type { SqlValue } from "../../types/common.ts";
import type { DbResult, SqlInfo } from "../../types/database.ts";

export type MockMySqlColumn = {
    name: string;
    dataType: string;
    columnType: string;
    max: number | null;
    nullable: boolean;
    defaultValue: SqlValue | null;
    comment: string;
};

export type MockMySqlTable = {
    columns: Record<string, MockMySqlColumn>;
    indexes: Record<string, string[]>;
};

export type MockMySqlState = {
    executedSql: string[];
    dbName: string;
    tables: Record<string, MockMySqlTable>;
    versionText?: string;
};

type SqlExecutor = {
    unsafe<T = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>>;
};

function makeSqlInfo(sql: string, params: SqlValue[]): SqlInfo {
    return {
        sql: sql,
        params: params,
        duration: 0
    };
}

function normalizeParams(params?: unknown[]): SqlValue[] {
    if (!Array.isArray(params)) return [];

    const out: SqlValue[] = [];
    for (const p of params) {
        if (p === undefined) {
            out.push("undefined");
        } else {
            out.push(p as any);
        }
    }
    return out;
}

function parseCreateTableSql(sql: string): { tableName: string; columnDefs: string[] } {
    const m = /^CREATE\s+TABLE\s+`([^`]+)`\s*\((.*)\)\s*ENGINE=/is.exec(sql);
    if (!m || !m[1] || typeof m[2] !== "string") {
        throw new Error(`mockMySqlDb: 无法解析 CREATE TABLE SQL: ${sql}`);
    }

    const tableName = m[1];

    const raw = m[2];
    const parts = raw
        .split(/,\s*\n\s*/g)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    return {
        tableName: tableName,
        columnDefs: parts
    };
}

function parseColumnDef(def: string): MockMySqlColumn {
    const m = /^`([^`]+)`\s+(.+)$/.exec(def);
    if (!m || !m[1] || !m[2]) {
        throw new Error(`mockMySqlDb: 无法解析列定义: ${def}`);
    }

    const name = m[1];
    const rest = m[2];

    const commentMatch = /COMMENT\s+"([^"]*)"/i.exec(rest);
    const comment = commentMatch ? commentMatch[1] : "";

    const nullable = /\bNOT\s+NULL\b/i.test(rest) ? false : /\bNULL\b/i.test(rest);

    const defaultMatch = /\bDEFAULT\s+([^\s]+|'[^']*(?:''[^']*)*')/i.exec(rest);
    let defaultValue: SqlValue | null = null;
    if (defaultMatch && typeof defaultMatch[1] === "string") {
        const raw = defaultMatch[1];
        if (raw === "null" || raw === "NULL") {
            defaultValue = null;
        } else if (raw.startsWith("'") && raw.endsWith("'")) {
            defaultValue = raw.slice(1, -1).replace(/''/g, "'");
        } else {
            const n = Number(raw);
            defaultValue = Number.isFinite(n) ? n : (raw as any);
        }
    }

    let dataType = "";
    let columnType = "";
    let max: number | null = null;

    const varcharMatch = /\bVARCHAR\s*\((\d+)\)/i.exec(rest);
    if (varcharMatch && varcharMatch[1]) {
        dataType = "varchar";
        columnType = `varchar(${varcharMatch[1]})`;
        max = Number(varcharMatch[1]);
    } else if (/\bMEDIUMTEXT\b/i.test(rest)) {
        dataType = "mediumtext";
        columnType = "mediumtext";
        max = null;
    } else if (/\bBIGINT\b/i.test(rest)) {
        dataType = "bigint";
        columnType = /\bUNSIGNED\b/i.test(rest) ? "bigint unsigned" : "bigint";
        max = null;
    } else {
        // 兜底：尽量提取第一个 token 作为类型
        const token = rest.trim().split(/\s+/)[0] || "";
        dataType = token.toLowerCase();
        columnType = token.toLowerCase();
        max = null;
    }

    return {
        name: name,
        dataType: dataType,
        columnType: columnType,
        max: max,
        nullable: nullable,
        defaultValue: defaultValue,
        comment: comment
    };
}

function parseAlterTableTarget(sql: string): string {
    const m = /^ALTER\s+TABLE\s+`([^`]+)`\s+/i.exec(sql);
    if (!m || !m[1]) {
        throw new Error(`mockMySqlDb: 无法解析 ALTER TABLE 目标表: ${sql}`);
    }
    return m[1];
}

function applyAlterClauses(state: MockMySqlState, tableName: string, sql: string): void {
    const table = state.tables[tableName];
    if (!table) {
        throw new Error(`mockMySqlDb: ALTER TABLE 目标表不存在: ${tableName}`);
    }

    // 处理 ADD COLUMN / MODIFY COLUMN / DROP INDEX / ADD INDEX
    // 这里以“包含关键字”为准做最小解析，足够覆盖当前单测。

    const addColumnMatches = sql.match(/ADD\s+COLUMN\s+`[^`]+`[^,]*/gi) || [];
    for (const clause of addColumnMatches) {
        const colDef = clause.replace(/^ADD\s+COLUMN\s+/i, "").trim();
        const col = parseColumnDef(colDef);
        table.columns[col.name] = col;
    }

    const modifyColumnMatches = sql.match(/MODIFY\s+COLUMN\s+`[^`]+`[^,]*/gi) || [];
    for (const clause of modifyColumnMatches) {
        const colDef = clause.replace(/^MODIFY\s+COLUMN\s+/i, "").trim();
        const col = parseColumnDef(colDef);
        table.columns[col.name] = col;
    }

    const dropIndexMatches = sql.match(/DROP\s+INDEX\s+`[^`]+`/gi) || [];
    for (const clause of dropIndexMatches) {
        const m = /DROP\s+INDEX\s+`([^`]+)`/i.exec(clause);
        if (m && m[1]) {
            delete table.indexes[m[1]];
        }
    }

    const addIndexMatches = sql.match(/ADD\s+(?:UNIQUE\s+)?INDEX\s+`[^`]+`\s*\([^)]*\)/gi) || [];
    for (const clause of addIndexMatches) {
        const m = /ADD\s+(?:UNIQUE\s+)?INDEX\s+`([^`]+)`\s*\(([^)]*)\)/i.exec(clause);
        if (!m || !m[1] || typeof m[2] !== "string") continue;

        const indexName = m[1];
        const colsRaw = m[2];
        const cols: string[] = [];

        // 只识别反引号包裹的列名：`a`, `b`
        const colMatches = colsRaw.match(/`([^`]+)`/g) || [];
        for (const token of colMatches) {
            const cm = /^`([^`]+)`$/.exec(token.trim());
            if (cm && cm[1]) cols.push(cm[1]);
        }

        if (cols.length > 0) {
            table.indexes[indexName] = cols;
        }
    }

    // ALTER COLUMN ... SET DEFAULT：仅更新 defaultValue
    const alterDefaultMatches = sql.match(/ALTER\s+COLUMN\s+`[^`]+`\s+SET\s+DEFAULT\s+[^,]+/gi) || [];
    for (const clause of alterDefaultMatches) {
        const m = /ALTER\s+COLUMN\s+`([^`]+)`\s+SET\s+DEFAULT\s+(.+)$/i.exec(clause.trim());
        if (!m || !m[1] || !m[2]) continue;

        const colName = m[1];
        const v = m[2].trim();

        if (!table.columns[colName]) continue;

        if (v.startsWith("'") && v.endsWith("'")) {
            table.columns[colName].defaultValue = v.slice(1, -1).replace(/''/g, "'");
        } else {
            const n = Number(v);
            table.columns[colName].defaultValue = Number.isFinite(n) ? n : (v as any);
        }
    }
}

export function createMockMySqlDb(state: MockMySqlState): SqlExecutor {
    return {
        unsafe: async <T = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>> => {
            const sql = String(sqlStr);
            state.executedSql.push(sql);

            const safeParams = normalizeParams(params);

            if (sql === "SELECT VERSION() AS version") {
                const versionText = state.versionText ? state.versionText : "8.0.36";
                return {
                    data: [{ version: versionText }] as any,
                    sql: makeSqlInfo(sql, safeParams)
                };
            }

            if (sql.toLowerCase().includes("information_schema") && sql.toLowerCase().includes("tables")) {
                const tableName = String(safeParams[1] || "");
                const exists = Boolean(state.tables[tableName]);
                return {
                    data: [{ count: exists ? 1 : 0 }] as any,
                    sql: makeSqlInfo(sql, safeParams)
                };
            }

            if (sql.toLowerCase().includes("information_schema") && sql.toLowerCase().includes("columns")) {
                const tableName = String(safeParams[1] || "");
                const table = state.tables[tableName];
                if (!table) {
                    return {
                        data: [] as any,
                        sql: makeSqlInfo(sql, safeParams)
                    };
                }

                const rows = Object.values(table.columns).map((c) => {
                    return {
                        COLUMN_NAME: c.name,
                        DATA_TYPE: c.dataType,
                        COLUMN_TYPE: c.columnType,
                        CHARACTER_MAXIMUM_LENGTH: c.max,
                        IS_NULLABLE: c.nullable ? "YES" : "NO",
                        COLUMN_DEFAULT: c.defaultValue,
                        COLUMN_COMMENT: c.comment
                    };
                });

                return {
                    data: rows as any,
                    sql: makeSqlInfo(sql, safeParams)
                };
            }

            if (sql.toLowerCase().includes("information_schema") && sql.toLowerCase().includes("statistics")) {
                const tableName = String(safeParams[1] || "");
                const table = state.tables[tableName];
                if (!table) {
                    return {
                        data: [] as any,
                        sql: makeSqlInfo(sql, safeParams)
                    };
                }

                const rows: Array<{ INDEX_NAME: string; COLUMN_NAME: string }> = [];
                for (const [idxName, cols] of Object.entries(table.indexes)) {
                    for (const col of cols) {
                        rows.push({ INDEX_NAME: idxName, COLUMN_NAME: col });
                    }
                }

                return {
                    data: rows as any,
                    sql: makeSqlInfo(sql, safeParams)
                };
            }

            if (/^CREATE\s+TABLE\s+`/i.test(sql)) {
                const parsed = parseCreateTableSql(sql);
                const columns: Record<string, MockMySqlColumn> = {};
                for (const def of parsed.columnDefs) {
                    const col = parseColumnDef(def);
                    columns[col.name] = col;
                }

                state.tables[parsed.tableName] = {
                    columns: columns,
                    indexes: {}
                };

                return {
                    data: [] as any,
                    sql: makeSqlInfo(sql, safeParams)
                };
            }

            if (/^ALTER\s+TABLE\s+`/i.test(sql)) {
                const tableName = parseAlterTableTarget(sql);
                applyAlterClauses(state, tableName, sql);
                return {
                    data: [] as any,
                    sql: makeSqlInfo(sql, safeParams)
                };
            }

            throw new Error(`mockMySqlDb: unexpected SQL: ${sql}`);
        }
    };
}
