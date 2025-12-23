/**
 * syncTable 表结构查询模块测试
 *
 * 测试 schema.ts 中的函数（纯逻辑测试，不需要数据库连接）：
 * - tableExists
 * - getTableColumns
 * - getTableIndexes
 *
 * 注意：这些是模拟测试，实际数据库操作需要集成测试
 */

import { describe, test, expect } from "bun:test";

import { setDbType, tableExists, getTableColumns, getTableIndexes } from "../sync/syncTable.js";

// 设置数据库类型为 MySQL
setDbType("mysql");

describe("tableExists", () => {
    test("sql 客户端未初始化时抛出错误", async () => {
        try {
            await tableExists(null, "user", "test_db");
            expect(true).toBe(false); // 不应该到这里
        } catch (error: any) {
            expect(error.message).toBe("SQL 执行器未初始化");
        }
    });

    test("传入有效 sql 客户端时正常执行", async () => {
        // 创建模拟 SQL 客户端
        const mockSql = {
            unsafe: async (_query: string, _params?: any[]) => {
                return [{ count: 1 }];
            }
        };

        const result = await tableExists(mockSql, "user", "test_db");
        expect(result).toBe(true);
    });

    test("表不存在时返回 false", async () => {
        const mockSql = {
            unsafe: async (_query: string, _params?: any[]) => {
                return [{ count: 0 }];
            }
        };

        const result = await tableExists(mockSql, "nonexistent", "test_db");
        expect(result).toBe(false);
    });
});

describe("getTableColumns", () => {
    test("返回正确的列信息结构", async () => {
        const mockSql = {
            unsafe: async (_query: string, _params?: any[]) => {
                // 模拟 MySQL information_schema 返回
                return [
                    {
                        COLUMN_NAME: "id",
                        DATA_TYPE: "bigint",
                        CHARACTER_MAXIMUM_LENGTH: null,
                        IS_NULLABLE: "NO",
                        COLUMN_DEFAULT: null,
                        COLUMN_COMMENT: "主键ID",
                        COLUMN_TYPE: "bigint unsigned"
                    },
                    {
                        COLUMN_NAME: "user_name",
                        DATA_TYPE: "varchar",
                        CHARACTER_MAXIMUM_LENGTH: 50,
                        IS_NULLABLE: "NO",
                        COLUMN_DEFAULT: "",
                        COLUMN_COMMENT: "用户名",
                        COLUMN_TYPE: "varchar(50)"
                    },
                    {
                        COLUMN_NAME: "age",
                        DATA_TYPE: "bigint",
                        CHARACTER_MAXIMUM_LENGTH: null,
                        IS_NULLABLE: "YES",
                        COLUMN_DEFAULT: "0",
                        COLUMN_COMMENT: "年龄",
                        COLUMN_TYPE: "bigint"
                    }
                ];
            }
        };

        const columns = await getTableColumns(mockSql, "user", "test_db");

        expect(columns.id).toBeDefined();
        expect(columns.id.type).toBe("bigint");
        expect(columns.id.nullable).toBe(false);
        expect(columns.id.comment).toBe("主键ID");

        expect(columns.user_name).toBeDefined();
        expect(columns.user_name.type).toBe("varchar");
        expect(columns.user_name.max).toBe(50);
        expect(columns.user_name.nullable).toBe(false);
        expect(columns.user_name.defaultValue).toBe("");

        expect(columns.age).toBeDefined();
        expect(columns.age.nullable).toBe(true);
        expect(columns.age.defaultValue).toBe("0");
    });
});

describe("getTableIndexes", () => {
    test("返回正确的索引信息结构", async () => {
        const mockSql = {
            unsafe: async (_query: string, _params?: any[]) => {
                // 模拟 MySQL information_schema.STATISTICS 返回
                // 注意：PRIMARY 索引被排除
                return [
                    { INDEX_NAME: "idx_created_at", COLUMN_NAME: "created_at" },
                    { INDEX_NAME: "idx_user_name", COLUMN_NAME: "user_name" }
                ];
            }
        };

        const indexes = await getTableIndexes(mockSql, "user", "test_db");

        // PRIMARY 索引被排除，不应存在
        expect(indexes.PRIMARY).toBeUndefined();

        expect(indexes.idx_created_at).toBeDefined();
        expect(indexes.idx_created_at).toContain("created_at");

        expect(indexes.idx_user_name).toBeDefined();
        expect(indexes.idx_user_name).toContain("user_name");
    });

    test("复合索引包含多个列", async () => {
        const mockSql = {
            unsafe: async (_query: string, _params?: any[]) => {
                // 模拟复合索引，同一索引名包含多个列
                return [
                    { INDEX_NAME: "idx_composite", COLUMN_NAME: "user_id" },
                    { INDEX_NAME: "idx_composite", COLUMN_NAME: "created_at" }
                ];
            }
        };

        const indexes = await getTableIndexes(mockSql, "user", "test_db");

        expect(indexes.idx_composite).toBeDefined();
        expect(indexes.idx_composite.length).toBe(2);
        expect(indexes.idx_composite).toContain("user_id");
        expect(indexes.idx_composite).toContain("created_at");
    });
});
