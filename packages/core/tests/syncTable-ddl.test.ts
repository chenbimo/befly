/**
 * syncTable DDL 构建模块测试
 *
 * 测试 ddl.ts 中的函数：
 * - buildIndexSQL
 * - buildSystemColumnDefs
 * - buildBusinessColumnDefs
 * - generateDDLClause
 * - isCompatibleTypeChange
 */

import type { FieldDefinition } from "../types/validate.ts";

import { describe, test, expect } from "bun:test";

import { syncTable } from "../sync/syncTable.ts";

describe("buildIndexSQL (MySQL)", () => {
    test("创建索引 SQL", () => {
        const sql = syncTable.TestKit.buildIndexSQL("user", "idx_created_at", "created_at", "create");
        expect(sql).toContain("ALTER TABLE `user`");
        expect(sql).toContain("ADD INDEX `idx_created_at`");
        expect(sql).toContain("(`created_at`)");
        expect(sql).toContain("ALGORITHM=INPLACE");
        expect(sql).toContain("LOCK=NONE");
    });

    test("删除索引 SQL", () => {
        const sql = syncTable.TestKit.buildIndexSQL("user", "idx_created_at", "created_at", "drop");
        expect(sql).toContain("ALTER TABLE `user`");
        expect(sql).toContain("DROP INDEX `idx_created_at`");
    });
});

describe("buildSystemColumnDefs (MySQL)", () => {
    test("返回 5 个系统字段定义", () => {
        const defs = syncTable.TestKit.buildSystemColumnDefs();
        expect(defs.length).toBe(5);
    });

    test("包含 id 主键", () => {
        const defs = syncTable.TestKit.buildSystemColumnDefs();
        const idDef = defs.find((d: string) => d.includes("`id`"));
        expect(idDef).toContain("PRIMARY KEY");
        expect(idDef).toContain("AUTO_INCREMENT");
        expect(idDef).toContain("BIGINT UNSIGNED");
    });

    test("包含 created_at 字段", () => {
        const defs = syncTable.TestKit.buildSystemColumnDefs();
        const def = defs.find((d: string) => d.includes("`created_at`"));
        expect(def).toContain("BIGINT UNSIGNED");
        expect(def).toContain("NOT NULL");
        expect(def).toContain("DEFAULT 0");
    });

    test("包含 state 字段", () => {
        const defs = syncTable.TestKit.buildSystemColumnDefs();
        const def = defs.find((d: string) => d.includes("`state`"));
        expect(def).toContain("BIGINT UNSIGNED");
        expect(def).toContain("NOT NULL");
        expect(def).toContain("DEFAULT 1");
    });
});

describe("buildBusinessColumnDefs (MySQL)", () => {
    test("生成 string 类型字段", () => {
        const fields = {
            userName: {
                name: "用户名",
                type: "string",
                max: 50,
                default: null,
                unique: false,
                nullable: false,
                unsigned: true
            }
        } satisfies Record<string, FieldDefinition>;
        const defs = syncTable.TestKit.buildBusinessColumnDefs(fields);
        expect(defs.length).toBe(1);
        expect(defs[0]).toContain("`user_name`");
        expect(defs[0]).toContain("VARCHAR(50)");
        expect(defs[0]).toContain("NOT NULL");
        expect(defs[0]).toContain("DEFAULT ''");
        expect(defs[0]).toContain('COMMENT "用户名"');
    });

    test("生成 number 类型字段", () => {
        const fields = {
            age: {
                name: "年龄",
                type: "number",
                max: null,
                default: 0,
                unique: false,
                nullable: false,
                unsigned: true
            }
        } satisfies Record<string, FieldDefinition>;
        const defs = syncTable.TestKit.buildBusinessColumnDefs(fields);
        expect(defs[0]).toContain("`age`");
        expect(defs[0]).toContain("BIGINT UNSIGNED");
        expect(defs[0]).toContain("DEFAULT 0");
    });

    test("生成 unique 字段", () => {
        const fields = {
            email: {
                name: "邮箱",
                type: "string",
                max: 100,
                default: null,
                unique: true,
                nullable: false,
                unsigned: true
            }
        } satisfies Record<string, FieldDefinition>;
        const defs = syncTable.TestKit.buildBusinessColumnDefs(fields);
        expect(defs[0]).toContain("UNIQUE");
    });

    test("生成 nullable 字段", () => {
        const fields = {
            remark: {
                name: "备注",
                type: "string",
                max: 200,
                default: null,
                unique: false,
                nullable: true,
                unsigned: true
            }
        } satisfies Record<string, FieldDefinition>;
        const defs = syncTable.TestKit.buildBusinessColumnDefs(fields);
        expect(defs[0]).toContain("NULL");
        expect(defs[0]).not.toContain("NOT NULL");
    });
});

describe("generateDDLClause (MySQL)", () => {
    test("生成 ADD COLUMN 子句", () => {
        const fieldDef = {
            name: "用户名",
            type: "string",
            max: 50,
            default: null,
            unique: false,
            nullable: false,
            unsigned: true
        } satisfies FieldDefinition;
        const clause = syncTable.TestKit.generateDDLClause("userName", fieldDef, true);
        expect(clause).toContain("ADD COLUMN");
        expect(clause).toContain("`user_name`");
        expect(clause).toContain("VARCHAR(50)");
    });

    test("生成 MODIFY COLUMN 子句", () => {
        const fieldDef = {
            name: "用户名",
            type: "string",
            max: 100,
            default: null,
            unique: false,
            nullable: false,
            unsigned: true
        } satisfies FieldDefinition;
        const clause = syncTable.TestKit.generateDDLClause("userName", fieldDef, false);
        expect(clause).toContain("MODIFY COLUMN");
        expect(clause).toContain("`user_name`");
        expect(clause).toContain("VARCHAR(100)");
    });
});

describe("isCompatibleTypeChange", () => {
    test("varchar -> text 是兼容变更", () => {
        expect(syncTable.TestKit.isCompatibleTypeChange("varchar(100)", "text")).toBe(true);
        expect(syncTable.TestKit.isCompatibleTypeChange("varchar(100)", "mediumtext")).toBe(true);
    });

    test("text -> varchar 不是兼容变更", () => {
        expect(syncTable.TestKit.isCompatibleTypeChange("text", "varchar(100)")).toBe(false);
    });

    test("int -> bigint 是兼容变更", () => {
        expect(syncTable.TestKit.isCompatibleTypeChange("int", "bigint")).toBe(true);
        expect(syncTable.TestKit.isCompatibleTypeChange("int unsigned", "bigint unsigned")).toBe(true);
        expect(syncTable.TestKit.isCompatibleTypeChange("tinyint", "int")).toBe(true);
        expect(syncTable.TestKit.isCompatibleTypeChange("tinyint", "bigint")).toBe(true);
        expect(syncTable.TestKit.isCompatibleTypeChange("smallint", "int")).toBe(true);
        expect(syncTable.TestKit.isCompatibleTypeChange("mediumint", "bigint")).toBe(true);
    });

    test("bigint -> int 不是兼容变更（收缩）", () => {
        expect(syncTable.TestKit.isCompatibleTypeChange("bigint", "int")).toBe(false);
        expect(syncTable.TestKit.isCompatibleTypeChange("int", "tinyint")).toBe(false);
    });

    test("相同类型不是变更", () => {
        expect(syncTable.TestKit.isCompatibleTypeChange("text", "text")).toBe(false);
        expect(syncTable.TestKit.isCompatibleTypeChange("bigint", "bigint")).toBe(false);
    });

    test("空值处理", () => {
        expect(syncTable.TestKit.isCompatibleTypeChange(null, "text")).toBe(false);
        expect(syncTable.TestKit.isCompatibleTypeChange("text", null)).toBe(false);
    });
});

describe("getSqlType / buildBusinessColumnDefs - varchar 约束", () => {
    test("string 类型未设置 max 时应抛错", () => {
        let thrownError: any = null;
        try {
            syncTable.TestKit.getSqlType("string", null);
        } catch (error: any) {
            thrownError = error;
        }

        expect(Boolean(thrownError)).toBe(true);
        expect(String(thrownError?.message || "")).toContain("必须设置 max");
    });

    test("string 类型 max 过大时应抛错", () => {
        let thrownError: any = null;
        try {
            syncTable.TestKit.getSqlType("string", 999999);
        } catch (error: any) {
            thrownError = error;
        }

        expect(Boolean(thrownError)).toBe(true);
        expect(String(thrownError?.message || "")).toContain("超出 VARCHAR 上限");
    });

    test("buildBusinessColumnDefs: string 类型缺失 max 时应抛错", () => {
        let thrownError: any = null;
        try {
            syncTable.TestKit.buildBusinessColumnDefs({
                userName: {
                    name: "用户名",
                    type: "string",
                    default: null,
                    unique: false,
                    nullable: false
                }
            } as any);
        } catch (error: any) {
            thrownError = error;
        }

        expect(Boolean(thrownError)).toBe(true);
        expect(String(thrownError?.message || "")).toContain("必须设置 max");
    });
});
