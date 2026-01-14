/**
 * syncTable 表结构查询模块测试（纯 mock，不连接真实数据库）
 */

import { describe, expect, test } from "bun:test";

import { syncTable } from "../sync/syncTable.ts";
import { createMockMySqlDb } from "./_mocks/mockMySqlDb.ts";

describe("tableExistsRuntime", () => {
    test("mock mysql：表存在返回 true；表不存在返回 false", async () => {
        const db = createMockMySqlDb({
            executedSql: [],
            dbName: "test",
            tables: {
                test_sync_table_exists: {
                    columns: {},
                    indexes: {}
                }
            }
        });

        const runtime = syncTable.TestKit.createRuntime(db, "test");
        const exist = await syncTable.TestKit.tableExistsRuntime(runtime, "test_sync_table_exists");
        expect(exist).toBe(true);

        const notExist = await syncTable.TestKit.tableExistsRuntime(runtime, "test_sync_table_not_exist_12345");
        expect(notExist).toBe(false);
    });
});

describe("getTableColumnsRuntime", () => {
    test("mock mysql：返回列信息结构（至少包含我们定义的列）", async () => {
        const db = createMockMySqlDb({
            executedSql: [],
            dbName: "test",
            tables: {
                test_sync_table_columns: {
                    columns: {
                        id: { name: "id", dataType: "bigint", columnType: "bigint", max: null, nullable: false, defaultValue: null, comment: "" },
                        user_name: { name: "user_name", dataType: "varchar", columnType: "varchar(64)", max: 64, nullable: true, defaultValue: "", comment: "" },
                        user_id: { name: "user_id", dataType: "bigint", columnType: "bigint", max: null, nullable: false, defaultValue: 0, comment: "" },
                        age: { name: "age", dataType: "bigint", columnType: "bigint", max: null, nullable: true, defaultValue: 0, comment: "" },
                        created_at: { name: "created_at", dataType: "bigint", columnType: "bigint", max: null, nullable: false, defaultValue: 0, comment: "" }
                    },
                    indexes: {}
                }
            }
        });

        const runtime = syncTable.TestKit.createRuntime(db, "test");
        const columns = await syncTable.TestKit.getTableColumnsRuntime(runtime, "test_sync_table_columns");

        expect(columns.id).toBeDefined();
        expect(columns.user_name).toBeDefined();
        expect(columns.user_id).toBeDefined();
        expect(columns.age).toBeDefined();
        expect(columns.created_at).toBeDefined();

        expect(columns.user_name.nullable).toBe(true);
    });
});

describe("getTableIndexesRuntime", () => {
    test("mock mysql：返回索引信息结构（支持复合索引列顺序）", async () => {
        const db = createMockMySqlDb({
            executedSql: [],
            dbName: "test",
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

        const runtime = syncTable.TestKit.createRuntime(db, "test");
        const indexes = await syncTable.TestKit.getTableIndexesRuntime(runtime, "test_sync_table_indexes");

        expect(indexes.idx_created_at).toBeDefined();
        expect(indexes.idx_created_at).toContain("created_at");

        expect(indexes.idx_user_name).toBeDefined();
        expect(indexes.idx_user_name).toContain("user_name");

        expect(indexes.idx_composite).toEqual(["user_id", "created_at"]);
    });
});
