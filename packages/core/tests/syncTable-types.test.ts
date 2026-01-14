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

import { syncTable } from "../sync/syncTable.ts";

describe("isStringOrArrayType", () => {
    test("string 类型返回 true", () => {
        expect(syncTable.TestKit.isStringOrArrayType("string")).toBe(true);
    });

    test("array_string 类型返回 true", () => {
        expect(syncTable.TestKit.isStringOrArrayType("array_string")).toBe(true);
    });

    test("number 类型返回 false", () => {
        expect(syncTable.TestKit.isStringOrArrayType("number")).toBe(false);
    });

    test("text 类型返回 false", () => {
        expect(syncTable.TestKit.isStringOrArrayType("text")).toBe(false);
    });

    test("array_text 类型返回 false", () => {
        expect(syncTable.TestKit.isStringOrArrayType("array_text")).toBe(false);
    });
});

describe("resolveDefaultValue", () => {
    test("null 值 + string 类型 => 空字符串", () => {
        expect(syncTable.TestKit.resolveDefaultValue(null, "string")).toBe("");
    });

    test("null 值 + number 类型 => 0", () => {
        expect(syncTable.TestKit.resolveDefaultValue(null, "number")).toBe(0);
    });

    test('"null" 字符串 + number 类型 => 0', () => {
        expect(syncTable.TestKit.resolveDefaultValue("null", "number")).toBe(0);
    });

    test('null 值 + array_string 类型 => "[]"', () => {
        expect(syncTable.TestKit.resolveDefaultValue(null, "array_string")).toBe("[]");
    });

    test('null 值 + text 类型 => "null"', () => {
        expect(syncTable.TestKit.resolveDefaultValue(null, "text")).toBe("null");
    });

    test('null 值 + array_text 类型 => "null"（TEXT 不支持默认值）', () => {
        expect(syncTable.TestKit.resolveDefaultValue(null, "array_text")).toBe("null");
    });

    test("有实际值时直接返回", () => {
        expect(syncTable.TestKit.resolveDefaultValue("admin", "string")).toBe("admin");
        expect(syncTable.TestKit.resolveDefaultValue(100, "number")).toBe(100);
        expect(syncTable.TestKit.resolveDefaultValue(0, "number")).toBe(0);
    });
});

describe("generateDefaultSql", () => {
    test("number 类型生成数字默认值", () => {
        expect(syncTable.TestKit.generateDefaultSql(0, "number")).toBe(" DEFAULT 0");
        expect(syncTable.TestKit.generateDefaultSql(100, "number")).toBe(" DEFAULT 100");
    });

    test("string 类型生成带引号默认值", () => {
        expect(syncTable.TestKit.generateDefaultSql("admin", "string")).toBe(" DEFAULT 'admin'");
        expect(syncTable.TestKit.generateDefaultSql("", "string")).toBe(" DEFAULT ''");
    });

    test("text 类型不生成默认值", () => {
        expect(syncTable.TestKit.generateDefaultSql("null", "text")).toBe("");
    });

    test("array_string 类型生成 JSON 数组默认值", () => {
        expect(syncTable.TestKit.generateDefaultSql("[]", "array_string")).toBe(" DEFAULT '[]'");
    });

    test("array_text 类型不生成默认值（MySQL TEXT 不支持）", () => {
        expect(syncTable.TestKit.generateDefaultSql("[]", "array_text")).toBe("");
    });

    test("单引号被正确转义", () => {
        expect(syncTable.TestKit.generateDefaultSql("it's", "string")).toBe(" DEFAULT 'it''s'");
    });
});

describe("getSqlType", () => {
    test("string 类型带长度", () => {
        const result = syncTable.TestKit.getSqlType("string", 100);
        expect(result).toBe("VARCHAR(100)");
    });

    test("array_string 类型带长度", () => {
        const result = syncTable.TestKit.getSqlType("array_string", 500);
        expect(result).toBe("VARCHAR(500)");
    });

    test("number 类型无符号", () => {
        const result = syncTable.TestKit.getSqlType("number", null, true);
        expect(result).toBe("BIGINT UNSIGNED");
    });

    test("number 类型有符号", () => {
        const result = syncTable.TestKit.getSqlType("number", null, false);
        expect(result).toBe("BIGINT");
    });

    test("text 类型", () => {
        const result = syncTable.TestKit.getSqlType("text", null);
        expect(result).toBe("MEDIUMTEXT");
    });
});

describe("quoteIdentifier", () => {
    test("合法标识符会被反引号包裹", () => {
        expect(syncTable.TestKit.quoteIdentifier("user")).toBe("`user`");
        expect(syncTable.TestKit.quoteIdentifier("user_name")).toBe("`user_name`");
        expect(syncTable.TestKit.quoteIdentifier("_tmp")).toBe("`_tmp`");
        expect(syncTable.TestKit.quoteIdentifier("user1")).toBe("`user1`");
    });

    test("会 trim 前后空白", () => {
        expect(syncTable.TestKit.quoteIdentifier(" user ")).toBe("`user`");
        expect(syncTable.TestKit.quoteIdentifier("  user_name  ")).toBe("`user_name`");
    });

    test("非法标识符会抛错（防 SQL 注入/误 DDL）", () => {
        expect(() => syncTable.TestKit.quoteIdentifier("")).toThrow("无效的 SQL 标识符");
        expect(() => syncTable.TestKit.quoteIdentifier("   ")).toThrow("无效的 SQL 标识符");
        expect(() => syncTable.TestKit.quoteIdentifier("user-name")).toThrow("无效的 SQL 标识符");
        expect(() => syncTable.TestKit.quoteIdentifier("user name")).toThrow("无效的 SQL 标识符");
        expect(() => syncTable.TestKit.quoteIdentifier("1user")).toThrow("无效的 SQL 标识符");
        expect(() => syncTable.TestKit.quoteIdentifier("user;drop table t")).toThrow("无效的 SQL 标识符");
        expect(() => syncTable.TestKit.quoteIdentifier("`user`")).toThrow("无效的 SQL 标识符");
    });
});
