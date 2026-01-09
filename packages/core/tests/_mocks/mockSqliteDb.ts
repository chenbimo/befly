import type { SqlValue } from "../../types/common.ts";
import type { DbResult, SqlInfo } from "../../types/database.ts";

import { toSqlParams } from "../../utils/sqlParams.ts";

type SqlExecutor = {
    unsafe<T = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>>;
};

export type MockColumn = { name: string; type: string; notnull: 0 | 1; dflt_value: string | number | null };

export type MockSqliteState = {
    executedSql: string[];
    tables: Record<
        string,
        {
            columns: Record<string, MockColumn>;
            indexes: Record<string, string[]>;
        }
    >;
};

function normalizeQuotedIdent(input: string): string {
    return String(input).trim().replace(/^`/, "").replace(/`$/, "").replace(/^"/, "").replace(/"$/, "");
}

function parseCreateTable(sql: string): { tableName: string; columnDefs: string } | null {
    const m = /^CREATE\s+TABLE\s+(.+?)\s*\((.*)\)\s*$/is.exec(sql.trim());
    if (!m) return null;
    return {
        tableName: normalizeQuotedIdent(m[1].trim()),
        columnDefs: m[2]
    };
}

function parseAlterAddColumn(sql: string): { tableName: string; colName: string; colType: string; notnull: 0 | 1; dflt: string | number | null } | null {
    const m = /^ALTER\s+TABLE\s+(.+?)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(.+?)\s+(.*)$/i.exec(sql.trim());
    if (!m) return null;

    const tableName = normalizeQuotedIdent(m[1].trim());
    const colName = normalizeQuotedIdent(m[2].trim());
    const rest = m[3];

    const upper = rest.toUpperCase();
    const colType = upper.includes("INTEGER") ? "INTEGER" : "TEXT";
    const notnull: 0 | 1 = upper.includes("NOT NULL") ? 1 : 0;

    let dflt: string | number | null = null;
    const dfltMatch = /\bDEFAULT\s+(.+?)(\s|$)/i.exec(rest);
    if (dfltMatch) {
        const raw = dfltMatch[1].trim();
        if (raw === "''") dflt = "";
        else if (raw.startsWith("'") && raw.endsWith("'")) dflt = raw.slice(1, -1).replace(/''/g, "'");
        else if (/^\d+$/.test(raw)) dflt = Number(raw);
        else dflt = raw;
    }

    return { tableName: tableName, colName: colName, colType: colType, notnull: notnull, dflt: dflt };
}

function parseCreateIndex(sql: string): { indexName: string; tableName: string; columns: string[] } | null {
    const m = /^CREATE\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(.+?)\s+ON\s+(.+?)\s*\((.+)\)\s*$/is.exec(sql.trim());
    if (!m) return null;

    const indexName = normalizeQuotedIdent(m[1].trim());
    const tableName = normalizeQuotedIdent(m[2].trim());
    const columns = m[3]
        .split(",")
        .map((s) => normalizeQuotedIdent(s.trim()))
        .filter((s) => s.length > 0);

    return { indexName: indexName, tableName: tableName, columns: columns };
}

function parseDropIndex(sql: string): { indexName: string } | null {
    const m = /^DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?(.+?)\s*$/i.exec(sql.trim());
    if (!m) return null;
    return { indexName: normalizeQuotedIdent(m[1].trim()) };
}

function extractPragmaIdent(sqlStr: string): string {
    const m = /\((.+)\)\s*$/i.exec(String(sqlStr).trim());
    return normalizeQuotedIdent(m ? m[1] : "");
}

export function createMockSqliteDb(state: MockSqliteState): SqlExecutor {
    return {
        unsafe: async (sqlStr: string, params?: unknown[]) => {
            const sql = String(sqlStr);
            state.executedSql.push(sql);

            const sqlParams: SqlValue[] = toSqlParams(params);
            const sqlInfo: SqlInfo = { sql: sql, params: sqlParams, duration: 0 };

            const ok = <T>(data: T): DbResult<T, SqlInfo> => {
                return { data: data, sql: sqlInfo };
            };

            if (sql.includes("sqlite_version()")) {
                return ok([{ version: "3.50.1" }]);
            }

            if (sql.includes("sqlite_master")) {
                const tableName = String(params?.[0] || "");
                return ok([{ count: state.tables[tableName] ? 1 : 0 }]);
            }

            if (/^PRAGMA\s+table_info\s*\(/i.test(sql)) {
                const tableName = extractPragmaIdent(sql);
                const t = state.tables[tableName];
                if (!t) return ok([]);
                return ok(
                    Object.values(t.columns).map((c) => {
                        return {
                            name: c.name,
                            type: c.type,
                            notnull: c.notnull,
                            dflt_value: c.dflt_value
                        };
                    })
                );
            }

            if (/^PRAGMA\s+index_list\s*\(/i.test(sql)) {
                const tableName = extractPragmaIdent(sql);
                const t = state.tables[tableName];
                if (!t) return ok([]);
                return ok(
                    Object.keys(t.indexes).map((name) => {
                        return { name: name };
                    })
                );
            }

            if (/^PRAGMA\s+index_info\s*\(/i.test(sql)) {
                const indexName = extractPragmaIdent(sql);
                for (const table of Object.values(state.tables)) {
                    if (table.indexes[indexName]) {
                        return ok(
                            table.indexes[indexName].map((col) => {
                                return { name: col };
                            })
                        );
                    }
                }
                return ok([]);
            }

            const createTable = parseCreateTable(sql);
            if (createTable) {
                const colMap: Record<string, MockColumn> = {};
                const parts = createTable.columnDefs
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0);

                for (const p of parts) {
                    const colMatch = /^(.+?)\s+(.+)$/s.exec(p);
                    if (!colMatch) continue;
                    const colName = normalizeQuotedIdent(colMatch[1].trim());
                    const rest = colMatch[2];

                    const upper = rest.toUpperCase();
                    const colType = upper.includes("INTEGER") ? "INTEGER" : upper.includes("BIGINT") ? "INTEGER" : "TEXT";
                    const notnull: 0 | 1 = upper.includes("NOT NULL") || upper.includes("PRIMARY KEY") ? 1 : 0;

                    let dflt: string | number | null = null;
                    const dfltMatch = /\bDEFAULT\s+(.+?)(\s|$)/i.exec(rest);
                    if (dfltMatch) {
                        const raw = dfltMatch[1].trim();
                        if (raw === "''") dflt = "";
                        else if (raw.startsWith("'") && raw.endsWith("'")) dflt = raw.slice(1, -1).replace(/''/g, "'");
                        else if (/^\d+$/.test(raw)) dflt = Number(raw);
                        else dflt = raw;
                    }

                    colMap[colName] = { name: colName, type: colType, notnull: notnull, dflt_value: dflt };
                }

                state.tables[createTable.tableName] = {
                    columns: colMap,
                    indexes: {}
                };

                return ok([]);
            }

            const addColumn = parseAlterAddColumn(sql);
            if (addColumn) {
                const t = state.tables[addColumn.tableName];
                if (!t) throw new Error(`mock sqlite db: 表不存在，无法 ADD COLUMN: ${addColumn.tableName}`);
                if (!t.columns[addColumn.colName]) {
                    t.columns[addColumn.colName] = {
                        name: addColumn.colName,
                        type: addColumn.colType,
                        notnull: addColumn.notnull,
                        dflt_value: addColumn.dflt
                    };
                }
                return ok([]);
            }

            const createIndex = parseCreateIndex(sql);
            if (createIndex) {
                const t = state.tables[createIndex.tableName];
                if (!t) throw new Error(`mock sqlite db: 表不存在，无法 CREATE INDEX: ${createIndex.tableName}`);
                t.indexes[createIndex.indexName] = createIndex.columns;
                return ok([]);
            }

            const dropIndex = parseDropIndex(sql);
            if (dropIndex) {
                for (const t of Object.values(state.tables)) {
                    delete t.indexes[dropIndex.indexName];
                }
                return ok([]);
            }

            if (/^DROP\s+TABLE/i.test(sql)) {
                return ok([]);
            }

            throw new Error(`mock sqlite db: 未处理的 SQL: ${sql}`);
        }
    };
}
