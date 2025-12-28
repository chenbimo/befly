/**
 * 防御测试：syncTable 的 runtime I/O 必须按 DbHelper 新合约读取 DbResult.data。
 *
 * 一旦有人把代码改回旧风格（把 unsafe() 当成直接返回数组），这里会立刻失败。
 */

import type { DbResult, SqlInfo } from "../types/database.js";

import { describe, expect, test } from "bun:test";

import { syncTable } from "../sync/syncTable.js";

type SqlExecutor = {
    unsafe<T = any>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>>;
};

function makeSqlInfo(options: { sql: string; params: unknown[] }): SqlInfo {
    return {
        sql: options.sql,
        params: options.params as any[],
        duration: 0
    };
}

describe("syncTable - SqlExecutor envelope contract", () => {
    test("tableExistsRuntime / getTableColumnsRuntime / getTableIndexesRuntime 必须读取 .data", async () => {
        const db: SqlExecutor = {
            unsafe: async (sqlStr: string, params?: unknown[]) => {
                const sql = String(sqlStr);
                const safeParams = Array.isArray(params) ? params : [];

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

        const runtime = syncTable.TestKit.createRuntime("sqlite", db as any, "");

        const exists = await syncTable.TestKit.tableExistsRuntime(runtime, "any_table");
        expect(exists).toBe(true);

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
                const safeParams = Array.isArray(params) ? params : [];

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
                    type: "mysql",
                    database: "test"
                }
            }
        } as any;

        await syncTable(ctx, []);
        expect(true).toBe(true);
    });
});
