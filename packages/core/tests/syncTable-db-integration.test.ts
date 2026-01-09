/**
 * syncTable 端到端行为测试（纯 mock，不连接真实数据库）
 */

import type { JsonValue } from "../types/common.ts";
import type { FieldDefinition } from "../types/validate.ts";
import type { ScanFileResult } from "../utils/scanFiles.ts";
import type { MockSqliteState } from "./_mocks/mockSqliteDb.ts";

import { describe, expect, test } from "bun:test";

import { CacheKeys } from "../lib/cacheKeys.ts";
import { syncTable } from "../sync/syncTable.ts";
import { createMockSqliteDb } from "./_mocks/mockSqliteDb.ts";

function buildTableItem(options: { tableFileName: string; content: Record<string, FieldDefinition> }): ScanFileResult {
    const item = {
        source: "app",
        type: "table",
        sourceName: "项目",
        filePath: "",
        relativePath: options.tableFileName,
        fileName: options.tableFileName,
        moduleName: `app_${options.tableFileName}`,
        addonName: "",
        fileBaseName: "",
        fileDir: "",
        content: options.content
    } satisfies ScanFileResult;

    return item;
}

function fdString(options: { name: string; min: number | null; max: number | null; defaultValue: JsonValue | null; nullable: boolean }): FieldDefinition {
    return {
        name: options.name,
        type: "string",
        min: options.min,
        max: options.max,
        default: options.defaultValue,
        nullable: options.nullable
    } satisfies FieldDefinition;
}

function fdNumber(options: { name: string; min: number | null; max: number | null; defaultValue: JsonValue | null; nullable: boolean }): FieldDefinition {
    return {
        name: options.name,
        type: "number",
        min: options.min,
        max: options.max,
        default: options.defaultValue,
        nullable: options.nullable
    } satisfies FieldDefinition;
}

function fdText(options: { name: string; min: number | null; max: number | null; defaultValue: JsonValue | null; nullable: boolean }): FieldDefinition {
    return {
        name: options.name,
        type: "text",
        min: options.min,
        max: options.max,
        default: options.defaultValue,
        nullable: options.nullable
    } satisfies FieldDefinition;
}

describe("syncTable(ctx, items) - mock sqlite", () => {
    test("首次同步：应创建表并包含系统字段 + 业务字段，同时清理 columns 缓存", async () => {
        const state: MockSqliteState = {
            executedSql: [],
            tables: {}
        };

        const db = createMockSqliteDb(state);

        const redisCalls: Array<{ keys: string[] }> = [];
        const ctx = {
            db: db,
            redis: {
                delBatch: async (keys: string[]) => {
                    redisCalls.push({ keys: keys });
                    return keys.length;
                }
            },
            config: {
                db: { type: "sqlite", database: "" }
            }
        } satisfies Parameters<typeof syncTable>[0];

        const tableFileName = "test_sync_table_integration_user";
        const item = buildTableItem({
            tableFileName: tableFileName,
            content: {
                email: fdString({ name: "邮箱", min: 0, max: 100, defaultValue: null, nullable: false }),
                nickname: fdString({ name: "昵称", min: 0, max: 50, defaultValue: "用户", nullable: true }),
                age: fdNumber({ name: "年龄", min: 0, max: 999, defaultValue: 0, nullable: true })
            }
        });

        await syncTable(ctx, [item]);

        expect(state.executedSql.some((s) => s.includes("CREATE TABLE") && s.includes(tableFileName))).toBe(true);

        const runtime = syncTable.TestKit.createRuntime("sqlite", db, "");
        const exists = await syncTable.TestKit.tableExistsRuntime(runtime, tableFileName);
        expect(exists).toBe(true);

        const columns = await syncTable.TestKit.getTableColumnsRuntime(runtime, tableFileName);

        expect(columns.id).toBeDefined();
        expect(columns.created_at).toBeDefined();
        expect(columns.updated_at).toBeDefined();
        expect(columns.state).toBeDefined();

        expect(columns.email).toBeDefined();
        expect(columns.nickname).toBeDefined();
        expect(columns.age).toBeDefined();

        expect(redisCalls.length).toBe(1);
        expect(redisCalls[0].keys).toEqual([CacheKeys.tableColumns(tableFileName)]);
    });

    test("二次同步：新增字段应落库（ADD COLUMN），同时清理 columns 缓存", async () => {
        const state: MockSqliteState = {
            executedSql: [],
            tables: {}
        };

        const db = createMockSqliteDb(state);

        const redisCalls: Array<{ keys: string[] }> = [];
        const ctx = {
            db: db,
            redis: {
                delBatch: async (keys: string[]) => {
                    redisCalls.push({ keys: keys });
                    return keys.length;
                }
            },
            config: {
                db: { type: "sqlite", database: "" }
            }
        } satisfies Parameters<typeof syncTable>[0];

        const tableFileName = "test_sync_table_integration_profile";

        const itemV1 = buildTableItem({
            tableFileName: tableFileName,
            content: {
                nickname: fdString({ name: "昵称", min: 0, max: 50, defaultValue: "用户", nullable: true })
            }
        });

        await syncTable(ctx, [itemV1]);

        const itemV2 = buildTableItem({
            tableFileName: tableFileName,
            content: {
                nickname: fdString({ name: "昵称", min: 0, max: 50, defaultValue: "用户", nullable: true }),
                bio: fdText({ name: "简介", min: 0, max: 200, defaultValue: null, nullable: true })
            }
        });

        await syncTable(ctx, [itemV2]);

        expect(state.executedSql.some((s) => s.includes("ALTER TABLE") && s.includes(tableFileName) && s.includes("ADD COLUMN") && s.includes("bio"))).toBe(true);

        const runtime = syncTable.TestKit.createRuntime("sqlite", db, "");
        const columns = await syncTable.TestKit.getTableColumnsRuntime(runtime, tableFileName);
        expect(columns.nickname).toBeDefined();
        expect(columns.bio).toBeDefined();

        // 两次同步，每次都会清一次缓存
        expect(redisCalls.length).toBe(2);
        expect(redisCalls[0].keys).toEqual([CacheKeys.tableColumns(tableFileName)]);
        expect(redisCalls[1].keys).toEqual([CacheKeys.tableColumns(tableFileName)]);
    });

    test("索引变更：仅删除单列索引；复合索引不会被误删", async () => {
        const tableFileName = "test_sync_table_integration_indexes";

        const state: MockSqliteState = {
            executedSql: [],
            tables: {
                [tableFileName]: {
                    columns: {
                        id: { name: "id", type: "INTEGER", notnull: 1, dflt_value: null },
                        created_at: { name: "created_at", type: "INTEGER", notnull: 1, dflt_value: "0" },
                        updated_at: { name: "updated_at", type: "INTEGER", notnull: 1, dflt_value: "0" },
                        deleted_at: { name: "deleted_at", type: "INTEGER", notnull: 1, dflt_value: "0" },
                        state: { name: "state", type: "INTEGER", notnull: 1, dflt_value: "1" },
                        user_id: { name: "user_id", type: "INTEGER", notnull: 1, dflt_value: "0" },
                        user_name: { name: "user_name", type: "TEXT", notnull: 1, dflt_value: "''" }
                    },
                    indexes: {
                        // 单列索引：应该能被识别并在 index=false 时被 drop
                        idx_user_name: ["user_name"],
                        // 复合索引：即使名字像单列索引，也因为多列而被 runtime 忽略，因此不会被 drop
                        idx_user_id: ["user_id", "created_at"]
                    }
                }
            }
        };

        const db = createMockSqliteDb(state);

        const redisCalls: Array<{ keys: string[] }> = [];
        const ctx = {
            db: db,
            redis: {
                delBatch: async (keys: string[]) => {
                    redisCalls.push({ keys: keys });
                    return keys.length;
                }
            },
            config: {
                db: { type: "sqlite", database: "" }
            }
        } satisfies Parameters<typeof syncTable>[0];

        const item = buildTableItem({
            tableFileName: tableFileName,
            content: {
                userId: fdNumber({ name: "用户ID", min: 0, max: 999999999, defaultValue: 0, nullable: false }),
                userName: fdString({ name: "用户名", min: 0, max: 50, defaultValue: "", nullable: false })
            }
        });

        await syncTable(ctx, [item]);

        const dropUserName = state.executedSql.some((s) => s.includes("DROP INDEX") && s.includes("idx_user_name"));
        expect(dropUserName).toBe(true);

        const dropUserIdComposite = state.executedSql.some((s) => s.includes("DROP INDEX") && s.includes("idx_user_id"));
        expect(dropUserIdComposite).toBe(false);

        expect(redisCalls.length).toBe(1);
        expect(redisCalls[0].keys).toEqual([CacheKeys.tableColumns(tableFileName)]);
    });
});
