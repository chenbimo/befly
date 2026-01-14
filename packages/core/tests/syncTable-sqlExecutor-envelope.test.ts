/**
 * 防御测试：syncTable 的 runtime I/O 必须按 DbHelper 新合约读取 DbResult.data。
 *
 * 仅支持 MySQL 8+。
 */

import type { SqlValue } from "../types/common.ts";
import type { SqlInfo } from "../types/database.ts";

import { describe, expect, test } from "bun:test";

import { checkTable } from "../checks/checkTable.ts";
import { SyncTable } from "../sync/syncTable.ts";
import { toSqlParams } from "../utils/sqlParams.ts";

type SqlExecutor = Parameters<typeof SyncTable.tableExistsIO>[0];

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
    test("tableExistsRuntime / getTableColumnsRuntime / getTableIndexesRuntime 必须读取 .data（MySQL）", async () => {
        const db: SqlExecutor = {
            unsafe: async (sqlStr: string, params?: unknown[]) => {
                const sql = String(sqlStr);
                const safeParams = toSqlParams(params);

                // table exists
                if (sql.toLowerCase().includes("information_schema") && sql.toLowerCase().includes("tables")) {
                    return {
                        data: [{ count: 1 }],
                        sql: makeSqlInfo({ sql: sql, params: safeParams })
                    };
                }

                // columns
                if (sql.toLowerCase().includes("information_schema") && sql.toLowerCase().includes("columns")) {
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

                // indexes
                if (sql.toLowerCase().includes("information_schema") && sql.toLowerCase().includes("statistics")) {
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

        const exists = await SyncTable.tableExistsIO(db, "test", "any_table");
        expect(exists).toBe(true);

        const cols = await SyncTable.getTableColumnsIO(db, "test", "any_table");
        expect(cols.id).toBeDefined();
        expect(cols.user_name).toBeDefined();
        expect(cols.user_name.nullable).toBe(true);

        const idx = await SyncTable.getTableIndexesIO(db, "test", "any_table");
        expect(idx.idx_user_name).toEqual(["user_name", "id"]);
    });

    test("runtime I/O 抛错时应保留 error.sqlInfo（便于定位 SQL）", async () => {
        const injectedSqlInfo = makeSqlInfo({ sql: "SELECT 1", params: [] });

        const db: SqlExecutor = {
            unsafe: async (_sqlStr: string, _params?: unknown[]) => {
                throw new SqlInfoError("boom", injectedSqlInfo);
            }
        };

        let thrown: unknown = null;
        try {
            await SyncTable.tableExistsIO(db, "test", "t_any");
        } catch (e: unknown) {
            thrown = e;
        }

        expect(thrown).toBeTruthy();
        expect(hasSqlInfo(thrown)).toBe(true);
        if (hasSqlInfo(thrown)) {
            expect(thrown.sqlInfo).toEqual(injectedSqlInfo);
        }
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
                    database: "test"
                }
            }
        } satisfies ConstructorParameters<typeof SyncTable>[0];

        await checkTable([]);
        await new SyncTable(ctx).run([]);
        expect(true).toBe(true);
    });

    test("ensureDbVersion：MySQL 8 以下应直接拒绝", async () => {
        const db: SqlExecutor = {
            unsafe: async (sqlStr: string, params?: unknown[]) => {
                const sql = String(sqlStr);
                const safeParams = toSqlParams(params);

                if (sql === "SELECT VERSION() AS version") {
                    return {
                        data: [{ version: "5.7.41" }],
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
                    database: "test"
                }
            }
        } satisfies ConstructorParameters<typeof SyncTable>[0];

        await checkTable([]);

        let thrown: unknown = null;
        try {
            await new SyncTable(ctx).run([]);
        } catch (e: unknown) {
            thrown = e;
        }

        expect(thrown).toBeTruthy();
        expect(String((thrown as any)?.message || thrown)).toContain("仅支持 MySQL 8.0+");
    });
});
