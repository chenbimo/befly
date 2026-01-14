/**
 * syncTable 常量模块测试
 *
 * 测试 constants.ts 中的常量：
 * - DB_VERSION_REQUIREMENTS
 * - SYSTEM_INDEX_FIELDS
 * - SYSTEM_INDEX_FIELDS
 * - CHANGE_TYPE_LABELS
 * - MYSQL_TABLE_CONFIG
 * - typeMapping
 */

import { describe, test, expect } from "bun:test";

import { syncTable } from "../sync/syncTable.ts";

describe("DB_VERSION_REQUIREMENTS", () => {
    test("MySQL 最低版本为 8", () => {
        expect(syncTable.TestKit.DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR).toBe(8);
    });
});

describe("SYSTEM_INDEX_FIELDS", () => {
    test("包含 created_at", () => {
        expect(syncTable.TestKit.SYSTEM_INDEX_FIELDS).toContain("created_at");
    });

    test("包含 updated_at", () => {
        expect(syncTable.TestKit.SYSTEM_INDEX_FIELDS).toContain("updated_at");
    });

    test("包含 state", () => {
        expect(syncTable.TestKit.SYSTEM_INDEX_FIELDS).toContain("state");
    });

    test("共 3 个系统索引字段", () => {
        expect(syncTable.TestKit.SYSTEM_INDEX_FIELDS.length).toBe(3);
    });
});

describe("CHANGE_TYPE_LABELS", () => {
    test('length 对应 "长度"', () => {
        expect(syncTable.TestKit.CHANGE_TYPE_LABELS["length"]).toBe("长度");
    });

    test('datatype 对应 "类型"', () => {
        expect(syncTable.TestKit.CHANGE_TYPE_LABELS.datatype).toBe("类型");
    });

    test('comment 对应 "注释"', () => {
        expect(syncTable.TestKit.CHANGE_TYPE_LABELS.comment).toBe("注释");
    });

    test('default 对应 "默认值"', () => {
        expect(syncTable.TestKit.CHANGE_TYPE_LABELS.default).toBe("默认值");
    });
});

describe("MYSQL_TABLE_CONFIG", () => {
    test("ENGINE 为 InnoDB", () => {
        expect(syncTable.TestKit.MYSQL_TABLE_CONFIG.ENGINE).toBe("InnoDB");
    });

    test("CHARSET 为 utf8mb4", () => {
        expect(syncTable.TestKit.MYSQL_TABLE_CONFIG.CHARSET).toBe("utf8mb4");
    });

    test("COLLATE 为 utf8mb4_0900_ai_ci", () => {
        expect(syncTable.TestKit.MYSQL_TABLE_CONFIG.COLLATE).toBe("utf8mb4_0900_ai_ci");
    });
});

describe("getTypeMapping (MySQL)", () => {
    test("number 映射为 BIGINT", () => {
        expect(syncTable.TestKit.getTypeMapping().number).toBe("BIGINT");
    });

    test("string 映射为 VARCHAR", () => {
        expect(syncTable.TestKit.getTypeMapping().string).toBe("VARCHAR");
    });

    test("text 映射为 MEDIUMTEXT", () => {
        expect(syncTable.TestKit.getTypeMapping().text).toBe("MEDIUMTEXT");
    });

    test("array_string 映射为 VARCHAR", () => {
        expect(syncTable.TestKit.getTypeMapping().array_string).toBe("VARCHAR");
    });

    test("array_text 映射为 MEDIUMTEXT", () => {
        expect(syncTable.TestKit.getTypeMapping().array_text).toBe("MEDIUMTEXT");
    });
});
