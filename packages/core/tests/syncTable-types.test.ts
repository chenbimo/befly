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

import { SyncTable } from "../sync/syncTable.js";

describe("isStringOrArrayType", () => {
    test("string 类型返回 true", () => {
        expect(SyncTable.isStringOrArrayType("string")).toBe(true);
    });

    test("array_string 类型返回 true", () => {
        expect(SyncTable.isStringOrArrayType("array_string")).toBe(true);
    });

    test("number 类型返回 false", () => {
        expect(SyncTable.isStringOrArrayType("number")).toBe(false);
    });

    test("text 类型返回 false", () => {
        expect(SyncTable.isStringOrArrayType("text")).toBe(false);
    });

    test("array_text 类型返回 false", () => {
        expect(SyncTable.isStringOrArrayType("array_text")).toBe(false);
    });
});

describe("resolveDefaultValue", () => {
    test("null 值 + string 类型 => 空字符串", () => {
        expect(SyncTable.resolveDefaultValue(null, "string")).toBe("");
    });

    test("null 值 + number 类型 => 0", () => {
        expect(SyncTable.resolveDefaultValue(null, "number")).toBe(0);
    });

    test('"null" 字符串 + number 类型 => 0', () => {
        expect(SyncTable.resolveDefaultValue("null", "number")).toBe(0);
    });

    test('null 值 + array_string 类型 => "[]"', () => {
        expect(SyncTable.resolveDefaultValue(null, "array_string")).toBe("[]");
    });

    test('null 值 + text 类型 => "null"', () => {
        expect(SyncTable.resolveDefaultValue(null, "text")).toBe("null");
    });

    test('null 值 + array_text 类型 => "null"（TEXT 不支持默认值）', () => {
        expect(SyncTable.resolveDefaultValue(null, "array_text")).toBe("null");
    });

    test("有实际值时直接返回", () => {
        expect(SyncTable.resolveDefaultValue("admin", "string")).toBe("admin");
        expect(SyncTable.resolveDefaultValue(100, "number")).toBe(100);
        expect(SyncTable.resolveDefaultValue(0, "number")).toBe(0);
    });
});

describe("generateDefaultSql", () => {
    test("number 类型生成数字默认值", () => {
        expect(SyncTable.generateDefaultSql(0, "number")).toBe(" DEFAULT 0");
        expect(SyncTable.generateDefaultSql(100, "number")).toBe(" DEFAULT 100");
    });

    test("string 类型生成带引号默认值", () => {
        expect(SyncTable.generateDefaultSql("admin", "string")).toBe(" DEFAULT 'admin'");
        expect(SyncTable.generateDefaultSql("", "string")).toBe(" DEFAULT ''");
    });

    test("text 类型不生成默认值", () => {
        expect(SyncTable.generateDefaultSql("null", "text")).toBe("");
    });

    test("array_string 类型生成 JSON 数组默认值", () => {
        expect(SyncTable.generateDefaultSql("[]", "array_string")).toBe(" DEFAULT '[]'");
    });

    test("array_text 类型不生成默认值（MySQL TEXT 不支持）", () => {
        expect(SyncTable.generateDefaultSql("[]", "array_text")).toBe("");
    });

    test("单引号被正确转义", () => {
        expect(SyncTable.generateDefaultSql("it's", "string")).toBe(" DEFAULT 'it''s'");
    });
});

describe("getSqlType", () => {
    test("string 类型带长度", () => {
        const result = SyncTable.getSqlType("mysql", "string", 100);
        expect(result).toBe("VARCHAR(100)");
    });

    test("array_string 类型带长度", () => {
        const result = SyncTable.getSqlType("mysql", "array_string", 500);
        expect(result).toBe("VARCHAR(500)");
    });

    test("number 类型无符号", () => {
        const result = SyncTable.getSqlType("mysql", "number", null, true);
        expect(result).toBe("BIGINT UNSIGNED");
    });

    test("number 类型有符号", () => {
        const result = SyncTable.getSqlType("mysql", "number", null, false);
        expect(result).toBe("BIGINT");
    });

    test("text 类型", () => {
        const result = SyncTable.getSqlType("mysql", "text", null);
        expect(result).toBe("MEDIUMTEXT");
    });
});
