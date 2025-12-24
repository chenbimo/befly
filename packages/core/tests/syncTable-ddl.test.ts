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

import { describe, test, expect } from "bun:test";

import { SyncTable } from "../sync/syncTable.js";

describe("buildIndexSQL (MySQL)", () => {
    test("创建索引 SQL", () => {
        const sql = SyncTable.TestKit.buildIndexSQL("mysql", "user", "idx_created_at", "created_at", "create");
        expect(sql).toContain("ALTER TABLE `user`");
        expect(sql).toContain("ADD INDEX `idx_created_at`");
        expect(sql).toContain("(`created_at`)");
        expect(sql).toContain("ALGORITHM=INPLACE");
        expect(sql).toContain("LOCK=NONE");
    });

    test("删除索引 SQL", () => {
        const sql = SyncTable.TestKit.buildIndexSQL("mysql", "user", "idx_created_at", "created_at", "drop");
        expect(sql).toContain("ALTER TABLE `user`");
        expect(sql).toContain("DROP INDEX `idx_created_at`");
    });
});

describe("buildSystemColumnDefs (MySQL)", () => {
    test("返回 5 个系统字段定义", () => {
        const defs = SyncTable.TestKit.buildSystemColumnDefs("mysql");
        expect(defs.length).toBe(5);
    });

    test("包含 id 主键", () => {
        const defs = SyncTable.TestKit.buildSystemColumnDefs("mysql");
        const idDef = defs.find((d: string) => d.includes("`id`"));
        expect(idDef).toContain("PRIMARY KEY");
        expect(idDef).toContain("AUTO_INCREMENT");
        expect(idDef).toContain("BIGINT UNSIGNED");
    });

    test("包含 created_at 字段", () => {
        const defs = SyncTable.TestKit.buildSystemColumnDefs("mysql");
        const def = defs.find((d: string) => d.includes("`created_at`"));
        expect(def).toContain("BIGINT UNSIGNED");
        expect(def).toContain("NOT NULL");
        expect(def).toContain("DEFAULT 0");
    });

    test("包含 state 字段", () => {
        const defs = SyncTable.TestKit.buildSystemColumnDefs("mysql");
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
        };
        const defs = SyncTable.TestKit.buildBusinessColumnDefs("mysql", fields as any);
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
        };
        const defs = SyncTable.TestKit.buildBusinessColumnDefs("mysql", fields as any);
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
        };
        const defs = SyncTable.TestKit.buildBusinessColumnDefs("mysql", fields as any);
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
        };
        const defs = SyncTable.TestKit.buildBusinessColumnDefs("mysql", fields as any);
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
        };
        const clause = SyncTable.TestKit.generateDDLClause("mysql", "userName", fieldDef as any, true);
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
        };
        const clause = SyncTable.TestKit.generateDDLClause("mysql", "userName", fieldDef as any, false);
        expect(clause).toContain("MODIFY COLUMN");
        expect(clause).toContain("`user_name`");
        expect(clause).toContain("VARCHAR(100)");
    });
});

describe("isCompatibleTypeChange", () => {
    test("varchar -> text 是兼容变更", () => {
        expect(SyncTable.TestKit.isCompatibleTypeChange("character varying", "text")).toBe(true);
        expect(SyncTable.TestKit.isCompatibleTypeChange("varchar(100)", "text")).toBe(true);
        expect(SyncTable.TestKit.isCompatibleTypeChange("varchar(100)", "mediumtext")).toBe(true);
    });

    test("text -> varchar 不是兼容变更", () => {
        expect(SyncTable.TestKit.isCompatibleTypeChange("text", "character varying")).toBe(false);
        expect(SyncTable.TestKit.isCompatibleTypeChange("text", "varchar(100)")).toBe(false);
    });

    test("int -> bigint 是兼容变更", () => {
        expect(SyncTable.TestKit.isCompatibleTypeChange("int", "bigint")).toBe(true);
        expect(SyncTable.TestKit.isCompatibleTypeChange("int unsigned", "bigint unsigned")).toBe(true);
        expect(SyncTable.TestKit.isCompatibleTypeChange("tinyint", "int")).toBe(true);
        expect(SyncTable.TestKit.isCompatibleTypeChange("tinyint", "bigint")).toBe(true);
        expect(SyncTable.TestKit.isCompatibleTypeChange("smallint", "int")).toBe(true);
        expect(SyncTable.TestKit.isCompatibleTypeChange("mediumint", "bigint")).toBe(true);
    });

    test("bigint -> int 不是兼容变更（收缩）", () => {
        expect(SyncTable.TestKit.isCompatibleTypeChange("bigint", "int")).toBe(false);
        expect(SyncTable.TestKit.isCompatibleTypeChange("int", "tinyint")).toBe(false);
    });

    test("PG integer -> bigint 是兼容变更", () => {
        expect(SyncTable.TestKit.isCompatibleTypeChange("integer", "bigint")).toBe(true);
        expect(SyncTable.TestKit.isCompatibleTypeChange("smallint", "integer")).toBe(true);
        expect(SyncTable.TestKit.isCompatibleTypeChange("smallint", "bigint")).toBe(true);
    });

    test("相同类型不是变更", () => {
        expect(SyncTable.TestKit.isCompatibleTypeChange("text", "text")).toBe(false);
        expect(SyncTable.TestKit.isCompatibleTypeChange("bigint", "bigint")).toBe(false);
    });

    test("空值处理", () => {
        expect(SyncTable.TestKit.isCompatibleTypeChange(null as any, "text")).toBe(false);
        expect(SyncTable.TestKit.isCompatibleTypeChange("text", null as any)).toBe(false);
    });
});
