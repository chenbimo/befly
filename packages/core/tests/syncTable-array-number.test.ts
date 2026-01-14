/**
 * 测试 syncTable 对 array_number_string 和 array_number_text 类型的支持
 */

import { describe, expect, test } from "bun:test";

import { SyncTable } from "../sync/syncTable.ts";

describe("syncTable - array_number 类型支持", () => {
    // ==================== 类型判断测试 ====================

    test("isStringOrArrayType: array_number_string 需要长度", () => {
        expect(SyncTable.isStringOrArrayType("array_number_string")).toBe(true);
    });

    test("isStringOrArrayType: array_number_text 不需要长度", () => {
        expect(SyncTable.isStringOrArrayType("array_number_text")).toBe(false);
    });

    // ==================== SQL 类型映射测试 ====================

    test("getSqlType: array_number_string 生成 VARCHAR(max)", () => {
        const sqlType = SyncTable.getSqlType("array_number_string", 500);
        expect(sqlType).toMatch(/VARCHAR\(500\)/i);
    });

    test("getSqlType: array_number_text 生成 TEXT/MEDIUMTEXT", () => {
        const sqlType = SyncTable.getSqlType("array_number_text", null);
        expect(sqlType).toMatch(/TEXT/i);
    });

    test("getSqlType: array_number_string 使用 max 参数", () => {
        const sqlType1 = SyncTable.getSqlType("array_number_string", 200);
        const sqlType2 = SyncTable.getSqlType("array_number_string", 1000);

        expect(sqlType1).toMatch(/VARCHAR\(200\)/i);
        expect(sqlType2).toMatch(/VARCHAR\(1000\)/i);
    });

    // ==================== 默认值处理测试 ====================

    test('resolveDefaultValue: array_number_string null 时返回 "[]"', () => {
        const result = SyncTable.resolveDefaultValue(null, "array_number_string");
        expect(result).toBe("[]");
    });

    test("resolveDefaultValue: array_number_string 有默认值时保留", () => {
        const result = SyncTable.resolveDefaultValue("[1,2,3]", "array_number_string");
        expect(result).toBe("[1,2,3]");
    });

    test('resolveDefaultValue: array_number_text null 时返回 "null"', () => {
        const result = SyncTable.resolveDefaultValue(null, "array_number_text");
        expect(result).toBe("null");
    });

    test("resolveDefaultValue: array_number_text 有默认值时保留", () => {
        const result = SyncTable.resolveDefaultValue("[100,200]", "array_number_text");
        expect(result).toBe("[100,200]");
    });

    test('resolveDefaultValue: 字符串 "null" 也视为 null', () => {
        const result1 = SyncTable.resolveDefaultValue("null", "array_number_string");
        const result2 = SyncTable.resolveDefaultValue("null", "array_number_text");

        expect(result1).toBe("[]");
        expect(result2).toBe("null");
    });

    // ==================== SQL DEFAULT 子句测试 ====================

    test("generateDefaultSql: array_number_string 生成 DEFAULT 子句", () => {
        const sql = SyncTable.generateDefaultSql("[]", "array_number_string");
        expect(sql).toBe(" DEFAULT '[]'");
    });

    test("generateDefaultSql: array_number_string 自定义默认值", () => {
        const sql = SyncTable.generateDefaultSql("[10,20,30]", "array_number_string");
        expect(sql).toBe(" DEFAULT '[10,20,30]'");
    });

    test("generateDefaultSql: array_number_text 不生成 DEFAULT", () => {
        const sql = SyncTable.generateDefaultSql("[]", "array_number_text");
        expect(sql).toBe("");
    });

    test("generateDefaultSql: array_number_text null 时不生成 DEFAULT", () => {
        const sql = SyncTable.generateDefaultSql("null", "array_number_text");
        expect(sql).toBe("");
    });

    // ==================== 单引号转义测试 ====================

    test("generateDefaultSql: 默认值包含单引号时正确转义", () => {
        const sql = SyncTable.generateDefaultSql("[1,'test',2]", "array_number_string");
        expect(sql).toBe(" DEFAULT '[1,''test'',2]'");
    });

    // ==================== 完整流程测试 ====================

    test("完整流程: array_number_string 字段定义", () => {
        // 模拟字段定义："标签ID|array_number_string|0|500|[]|0"
        const fieldType = "array_number_string";
        const fieldMax = 500;
        const fieldDefault = null;

        // 1. 判断是否需要长度
        expect(SyncTable.isStringOrArrayType(fieldType)).toBe(true);

        // 2. 获取 SQL 类型
        const sqlType = SyncTable.getSqlType(fieldType, fieldMax);
        expect(sqlType).toMatch(/VARCHAR\(500\)/i);

        // 3. 处理默认值
        const actualDefault = SyncTable.resolveDefaultValue(fieldDefault, fieldType);
        expect(actualDefault).toBe("[]");

        // 4. 生成 DEFAULT 子句
        const defaultSql = SyncTable.generateDefaultSql(actualDefault, fieldType);
        expect(defaultSql).toBe(" DEFAULT '[]'");
    });

    test("完整流程: array_number_text 字段定义", () => {
        // 模拟字段定义："关联ID|array_number_text|||null|0"
        const fieldType = "array_number_text";
        const fieldMax = null;
        const fieldDefault = null;

        // 1. 判断是否需要长度
        expect(SyncTable.isStringOrArrayType(fieldType)).toBe(false);

        // 2. 获取 SQL 类型
        const sqlType = SyncTable.getSqlType(fieldType, fieldMax);
        expect(sqlType).toMatch(/TEXT/i);

        // 3. 处理默认值
        const actualDefault = SyncTable.resolveDefaultValue(fieldDefault, fieldType);
        expect(actualDefault).toBe("null");

        // 4. 生成 DEFAULT 子句（TEXT 类型不支持）
        const defaultSql = SyncTable.generateDefaultSql(actualDefault, fieldType);
        expect(defaultSql).toBe("");
    });

    test("完整流程: array_number_string 自定义默认值", () => {
        // 模拟字段定义："分数|array_number_string|2|10|[60,70,80]|0"
        const fieldType = "array_number_string";
        const fieldMax = 10;
        const fieldDefault = "[60,70,80]";

        const sqlType = SyncTable.getSqlType(fieldType, fieldMax);
        expect(sqlType).toMatch(/VARCHAR\(10\)/i);

        const actualDefault = SyncTable.resolveDefaultValue(fieldDefault, fieldType);
        expect(actualDefault).toBe("[60,70,80]");

        const defaultSql = SyncTable.generateDefaultSql(actualDefault, fieldType);
        expect(defaultSql).toBe(" DEFAULT '[60,70,80]'");
    });
});
