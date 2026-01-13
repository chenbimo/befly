/**
 * syncTable 表结构查询模块测试（纯 mock，不连接真实数据库）
 */

import { describe, expect, test } from "bun:test";

import { syncTable } from "../sync/syncTable.ts";
import { createMockSqliteDb } from "./_mocks/mockSqliteDb.ts";

describe("tableExistsRuntime", () => {
    test("mock sqlite：表存在返回 true；表不存在返回 false", async () => {
        const db = createMockSqliteDb({
            executedSql: [],
            tables: {
                test_sync_table_exists: {
                    columns: {},
                    indexes: {}
                }
            }
        });

        const runtime = syncTable.TestKit.createRuntime("sqlite", db, "");
        const exist = await syncTable.TestKit.tableExistsRuntime(runtime, "test_sync_table_exists");
        expect(exist).toBe(true);

        const notExist = await syncTable.TestKit.tableExistsRuntime(runtime, "test_sync_table_not_exist_12345");
        expect(notExist).toBe(false);
    });
});

describe("getTableColumnsRuntime", () => {
    test("mock sqlite：返回列信息结构（至少包含我们定义的列）", async () => {
        const db = createMockSqliteDb({
            executedSql: [],
            tables: {
                test_sync_table_columns: {
                    columns: {
                        id: { name: "id", type: "INTEGER", notnull: 1, dflt_value: null },
                        user_name: { name: "user_name", type: "TEXT", notnull: 1, dflt_value: "''" },
                        user_id: { name: "user_id", type: "INTEGER", notnull: 1, dflt_value: "0" },
                        age: { name: "age", type: "INTEGER", notnull: 0, dflt_value: "0" },
                        created_at: { name: "created_at", type: "INTEGER", notnull: 1, dflt_value: "0" }
                    },
                    indexes: {}
                }
            }
        });

        const runtime = syncTable.TestKit.createRuntime("sqlite", db, "");
        const columns = await syncTable.TestKit.getTableColumnsRuntime(runtime, "test_sync_table_columns");

        expect(columns.id).toBeDefined();
        expect(columns.user_name).toBeDefined();
        expect(columns.user_id).toBeDefined();
        expect(columns.age).toBeDefined();
        expect(columns.created_at).toBeDefined();

        expect(columns.user_name.nullable).toBe(false);
    });
});

describe("getTableIndexesRuntime", () => {
    test("mock sqlite：返回索引信息结构（仅单列索引；复合索引会被忽略）", async () => {
        const db = createMockSqliteDb({
            executedSql: [],
            tables: {
                test_sync_table_indexes: {
                    columns: {},
                    indexes: {
                        idx_created_at: ["created_at"],
                        idx_user_name: ["user_name"],
                        idx_composite: ["user_id", "created_at"]
                    }
                }
            }
        });

        const runtime = syncTable.TestKit.createRuntime("sqlite", db, "");
        const indexes = await syncTable.TestKit.getTableIndexesRuntime(runtime, "test_sync_table_indexes");

        expect(indexes.idx_created_at).toBeDefined();
        expect(indexes.idx_created_at).toContain("created_at");

        expect(indexes.idx_user_name).toBeDefined();
        expect(indexes.idx_user_name).toContain("user_name");

        // sqlite 路径下为了避免多列索引误判，仅收集单列索引
        expect(indexes.idx_composite).toBeUndefined();
    });
});
