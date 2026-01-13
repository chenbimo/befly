/**
 * 防御测试：syncTable 的 runtime I/O 必须按 DbHelper 新合约读取 DbResult.data。
 *
 * 一旦有人把代码改回旧风格（把 unsafe() 当成直接返回数组），这里会立刻失败。
 */

import type { SqlInfo } from "../types/database.ts";

import { describe, expect, test } from "bun:test";

import { checkTable } from "../checks/checkTable.ts";
import { syncTable } from "../sync/syncTable.ts";
import { toSqlParams } from "../utils/sqlParams.ts";

type SqlExecutor = NonNullable<Parameters<typeof syncTable.TestKit.createRuntime>[1]>;

class SqlInfoError extends Error {
    public sqlInfo: SqlInfo;

    public constructor(message: string, sqlInfo: SqlInfo) {
        super(message);
        this.sqlInfo = sqlInfo;
    }
}

function hasSqlInfo(value: unknown): value is { sqlInfo: SqlInfo } {
    return typeof value === "object" && value !== null && "sqlInfo" in value;
}

function makeSqlInfo(options: { sql: string; params: SqlValue[] }): SqlInfo {
    return {
        sql: options.sql,
        params: options.params,
        duration: 0
    };
}

describe("syncTable - SqlExecutor envelope contract", () => {
    test("tableExistsRuntime / getTableColumnsRuntime / getTableIndexesRuntime 必须读取 .data", async () => {
        const db: SqlExecutor = {
            unsafe: async (sqlStr: string, params?: unknown[]) => {
                const sql = String(sqlStr);
                const safeParams = toSqlParams(params);

                // sqlite: table exists
                if (sql.includes("sqlite_master")) {
                    return {
                        data: [{ count: 1 }],
                        sql: makeSqlInfo({ sql: sql, params: safeParams })
                    };
                }

                // sqlite: columns
                if (/^PRAGMA\s+table_info\s*\(/i.test(sql)) {
                    return {
                        data: [
                            { name: "id", type: "INTEGER", notnull: 1, dflt_value: null },
                            { name: "user_name", type: "TEXT", notnull: 0, dflt_value: "''" }
                        ],
                        sql: makeSqlInfo({ sql: sql, params: safeParams })
                    };
                }

                // sqlite: indexes
                if (/^PRAGMA\s+index_list\s*\(/i.test(sql)) {
                    return {
                        data: [{ name: "idx_user_name" }],
                        sql: makeSqlInfo({ sql: sql, params: safeParams })
                    };
                }
                if (/^PRAGMA\s+index_info\s*\(/i.test(sql)) {
                    return {
                        data: [{ name: "user_name" }],
                        sql: makeSqlInfo({ sql: sql, params: safeParams })
                    };
                }

                throw new Error(`unexpected SQL in test: ${sql}`);
            }
        };

        const runtime = syncTable.TestKit.createRuntime("sqlite", db, "");

        const exists = await syncTable.TestKit.tableExistsRuntime(runtime, "any_table");
        expect(exists).toBe(true);

        const cols = await syncTable.TestKit.getTableColumnsRuntime(runtime, "any_table");
        expect(cols.id).toBeDefined();
        expect(cols.user_name).toBeDefined();
        expect(cols.user_name.nullable).toBe(true);

        const idx = await syncTable.TestKit.getTableIndexesRuntime(runtime, "any_table");
        expect(idx.idx_user_name).toEqual(["user_name"]);
    });

    test("runtime I/O 抛错时应保留 error.sqlInfo（便于定位 SQL）", async () => {
        const injectedSqlInfo = makeSqlInfo({ sql: "SELECT 1", params: [] });

        const db: SqlExecutor = {
            unsafe: async (_sqlStr: string, _params?: unknown[]) => {
                throw new SqlInfoError("boom", injectedSqlInfo);
            }
        };

        const runtime = syncTable.TestKit.createRuntime("sqlite", db, "");

        let thrown: unknown = null;
        try {
            await syncTable.TestKit.tableExistsRuntime(runtime, "t_any");
        } catch (e: unknown) {
            thrown = e;
        }

        expect(thrown).toBeTruthy();
        expect(hasSqlInfo(thrown)).toBe(true);
        if (hasSqlInfo(thrown)) {
            expect(thrown.sqlInfo).toEqual(injectedSqlInfo);
        }
    });

    test("mysql: getTableColumnsRuntime / getTableIndexesRuntime 必须读取 .data", async () => {
        const db: SqlExecutor = {
            unsafe: async (sqlStr: string, params?: unknown[]) => {
                const sql = String(sqlStr);
                const safeParams = toSqlParams(params);

                if (sql.includes("information_schema") && sql.toLowerCase().includes("columns")) {
                    return {
                        data: [
                            {
                                COLUMN_NAME: "id",
                                DATA_TYPE: "bigint",
                                COLUMN_TYPE: "bigint",
                                CHARACTER_MAXIMUM_LENGTH: null,
                                IS_NULLABLE: "NO",
                                COLUMN_DEFAULT: null,
                                COLUMN_COMMENT: ""
                            },
                            {
                                COLUMN_NAME: "user_name",
                                DATA_TYPE: "varchar",
                                COLUMN_TYPE: "varchar(64)",
                                CHARACTER_MAXIMUM_LENGTH: 64,
                                IS_NULLABLE: "YES",
                                COLUMN_DEFAULT: "",
                                COLUMN_COMMENT: ""
                            }
                        ],
                        sql: makeSqlInfo({ sql: sql, params: safeParams })
                    };
                }

                if (sql.includes("information_schema") && sql.toLowerCase().includes("statistics")) {
                    return {
                        data: [
                            { INDEX_NAME: "idx_user_name", COLUMN_NAME: "user_name" },
                            { INDEX_NAME: "idx_user_name", COLUMN_NAME: "id" }
                        ],
                        sql: makeSqlInfo({ sql: sql, params: safeParams })
                    };
                }

                throw new Error(`unexpected SQL in test: ${sql}`);
            }
        };

        const runtime = syncTable.TestKit.createRuntime("mysql", db, "test");

        const cols = await syncTable.TestKit.getTableColumnsRuntime(runtime, "any_table");
        expect(cols.id).toBeDefined();
        expect(cols.user_name).toBeDefined();
        expect(cols.user_name.nullable).toBe(true);

        const idx = await syncTable.TestKit.getTableIndexesRuntime(runtime, "any_table");
        expect(idx.idx_user_name).toEqual(["user_name", "id"]);
    });

    test("postgresql: getTableColumnsRuntime / getTableIndexesRuntime 必须读取 .data", async () => {
        const db: SqlExecutor = {
            unsafe: async (sqlStr: string, params?: unknown[]) => {
                const sql = String(sqlStr);
                const safeParams = toSqlParams(params);

                // columns
                if (sql.toLowerCase().includes("information_schema") && sql.toLowerCase().includes("columns")) {
                    return {
                        data: [
                            {
                                column_name: "id",
                                data_type: "bigint",
                                character_maximum_length: null,
                                is_nullable: "NO",
                                column_default: null
                            },
                            {
                                column_name: "user_name",
                                data_type: "text",
                                character_maximum_length: null,
                                is_nullable: "YES",
                                column_default: null
                            }
                        ],
                        sql: makeSqlInfo({ sql: sql, params: safeParams })
                    };
                }

                // comments
                if (sql.toLowerCase().includes("pg_description") || sql.toLowerCase().includes("col_description")) {
                    return {
                        data: [{ column_name: "user_name", column_comment: "" }],
                        sql: makeSqlInfo({ sql: sql, params: safeParams })
                    };
                }

                // indexes
                if (sql.toLowerCase().includes("pg_indexes")) {
                    return {
                        data: [{ indexname: "idx_user_name", indexdef: 'CREATE INDEX idx_user_name ON any_table ("user_name")' }],
                        sql: makeSqlInfo({ sql: sql, params: safeParams })
                    };
                }

                throw new Error(`unexpected SQL in test: ${sql}`);
            }
        };

        const runtime = syncTable.TestKit.createRuntime("postgresql", db, "");

        const cols = await syncTable.TestKit.getTableColumnsRuntime(runtime, "any_table");
        expect(cols.id).toBeDefined();
        expect(cols.user_name).toBeDefined();
        expect(cols.user_name.nullable).toBe(true);

        const idx = await syncTable.TestKit.getTableIndexesRuntime(runtime, "any_table");
        expect(idx.idx_user_name).toEqual(["user_name"]);
    });

    test("ensureDbVersion 必须读取 .data（通过 syncTable(ctx, []) 间接覆盖）", async () => {
        const db: SqlExecutor = {
            unsafe: async (sqlStr: string, params?: unknown[]) => {
                const sql = String(sqlStr);
                const safeParams = toSqlParams(params);

                if (sql === "SELECT VERSION() AS version") {
                    return {
                        data: [{ version: "8.0.36" }],
                        sql: makeSqlInfo({ sql: sql, params: safeParams })
                    };
                }

                throw new Error(`unexpected SQL in test: ${sql}`);
            }
        };

        const ctx = {
            db: db,
            redis: {
                delBatch: async (_keys: string[]) => {
                    return 0;
                }
            },
            config: {
                db: {
                    dialect: "mysql",
                    database: "test"
                }
            }
        } satisfies Parameters<typeof syncTable>[0];

        await checkTable([]);
        await syncTable(ctx, []);
        expect(true).toBe(true);
    });
});
