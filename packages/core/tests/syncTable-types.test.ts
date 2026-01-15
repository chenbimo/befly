/**
 * syncTable 类型处理模块测试
 *
 * 测试 types.ts 中的函数：
 * - isStringOrArrayType
 * - getSqlType
 * - resolveDefaultValue
 * - generateDefaultSql
 */

import { describe, test, expect } from "bun:test";

import { SyncTable } from "../sync/syncTable.ts";

describe("isStringOrArrayType", () => {
    test("char 类型返回 true", () => {
        expect(SyncTable.isStringOrArrayType("char")).toBe(true);
    });

    test("varchar 类型返回 true", () => {
        expect(SyncTable.isStringOrArrayType("varchar")).toBe(true);
    });

    test("bigint 类型返回 false", () => {
        expect(SyncTable.isStringOrArrayType("bigint")).toBe(false);
    });

    test("mediumtext 类型返回 false", () => {
        expect(SyncTable.isStringOrArrayType("mediumtext")).toBe(false);
    });

    test("json 类型返回 false", () => {
        expect(SyncTable.isStringOrArrayType("json")).toBe(false);
    });
});

describe("resolveDefaultValue", () => {
    test("null 值 + varchar 类型 => 空字符串", () => {
        expect(SyncTable.resolveDefaultValue(null, "varchar")).toBe("");
    });

    test("null 值 + tinyint 类型 => 0", () => {
        expect(SyncTable.resolveDefaultValue(null, "tinyint")).toBe(0);
    });

    test("null 值 + bigint 类型 => 0", () => {
        expect(SyncTable.resolveDefaultValue(null, "bigint")).toBe(0);
    });

    test('"null" 字符串 + bigint 类型 => 0', () => {
        expect(SyncTable.resolveDefaultValue("null", "bigint")).toBe(0);
    });

    test('null 值 + text 类型 => "null"', () => {
        expect(SyncTable.resolveDefaultValue(null, "text")).toBe("null");
    });

    test('null 值 + tinytext 类型 => "null"', () => {
        expect(SyncTable.resolveDefaultValue(null, "tinytext")).toBe("null");
    });

    test('null 值 + longtext 类型 => "null"', () => {
        expect(SyncTable.resolveDefaultValue(null, "longtext")).toBe("null");
    });

    test('null 值 + datetime 类型 => "null"（DATETIME 默认不生成 DEFAULT）', () => {
        expect(SyncTable.resolveDefaultValue(null, "datetime")).toBe("null");
    });

    test("有实际值时直接返回", () => {
        expect(SyncTable.resolveDefaultValue("admin", "varchar")).toBe("admin");
        expect(SyncTable.resolveDefaultValue(100, "bigint")).toBe(100);
        expect(SyncTable.resolveDefaultValue(0, "bigint")).toBe(0);
    });
});

describe("generateDefaultSql", () => {
    test("bigint 类型生成数字默认值", () => {
        expect(SyncTable.generateDefaultSql(0, "bigint")).toBe(" DEFAULT 0");
        expect(SyncTable.generateDefaultSql(100, "bigint")).toBe(" DEFAULT 100");
    });

    test("tinyint 类型生成数字默认值", () => {
        expect(SyncTable.generateDefaultSql(1, "tinyint")).toBe(" DEFAULT 1");
    });

    test("varchar 类型生成带引号默认值", () => {
        expect(SyncTable.generateDefaultSql("admin", "varchar")).toBe(" DEFAULT 'admin'");
        expect(SyncTable.generateDefaultSql("", "varchar")).toBe(" DEFAULT ''");
    });

    test("varchar 类型生成带引号默认值", () => {
        expect(SyncTable.generateDefaultSql("ok", "varchar")).toBe(" DEFAULT 'ok'");
    });

    test("text 类型不生成默认值", () => {
        expect(SyncTable.generateDefaultSql("null", "text")).toBe("");
    });

    test("tinytext 类型不生成默认值", () => {
        expect(SyncTable.generateDefaultSql("null", "tinytext")).toBe("");
    });

    test("longtext 类型不生成默认值", () => {
        expect(SyncTable.generateDefaultSql("null", "longtext")).toBe("");
    });

    test("datetime 类型默认值为 null 时不生成 DEFAULT", () => {
        expect(SyncTable.generateDefaultSql("null", "datetime")).toBe("");
    });

    test("datetime 类型生成带引号默认值", () => {
        expect(SyncTable.generateDefaultSql("2026-01-15 12:34:56", "datetime")).toBe(" DEFAULT '2026-01-15 12:34:56'");
    });

    test("单引号被正确转义", () => {
        expect(SyncTable.generateDefaultSql("it's", "varchar")).toBe(" DEFAULT 'it''s'");
    });
});

describe("getSqlType", () => {
    test("char 类型带长度", () => {
        const result = SyncTable.getSqlType("char", 16);
        expect(result).toBe("CHAR(16)");
    });

    test("varchar 类型带长度", () => {
        const result = SyncTable.getSqlType("varchar", 200);
        expect(result).toBe("VARCHAR(200)");
    });

    test("tinyint 类型无符号", () => {
        const result = SyncTable.getSqlType("tinyint", null, true);
        expect(result).toBe("TINYINT UNSIGNED");
    });

    test("text 类型", () => {
        const result = SyncTable.getSqlType("text", null);
        expect(result).toBe("MEDIUMTEXT");
    });

    test("tinytext 类型", () => {
        const result = SyncTable.getSqlType("tinytext", null);
        expect(result).toBe("TINYTEXT");
    });

    test("longtext 类型", () => {
        const result = SyncTable.getSqlType("longtext", null);
        expect(result).toBe("LONGTEXT");
    });

    test("datetime 类型", () => {
        const result = SyncTable.getSqlType("datetime", null);
        expect(result).toBe("DATETIME");
    });

    test("json 类型", () => {
        const result = SyncTable.getSqlType("json", null);
        expect(result).toBe("JSON");
    });
});
