/**
 * syncTable 常量模块测试
 *
 * 测试 constants.ts 中的常量：
 * - DB_VERSION_REQUIREMENTS
 * - SYSTEM_INDEX_FIELDS
 * - SYSTEM_INDEX_FIELDS
 * - MYSQL_TABLE_CONFIG
 * - typeMapping
 */

import { describe, test, expect } from "bun:test";

import { SyncTable } from "../sync/syncTable.ts";

describe("DB_VERSION_REQUIREMENTS", () => {
    test("MySQL 最低版本为 8", () => {
        expect(SyncTable.DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR).toBe(8);
    });
});

describe("SYSTEM_INDEX_FIELDS", () => {
    test("包含 created_at", () => {
        expect(SyncTable.SYSTEM_INDEX_FIELDS).toContain("created_at");
    });

    test("包含 updated_at", () => {
        expect(SyncTable.SYSTEM_INDEX_FIELDS).toContain("updated_at");
    });

    test("包含 state", () => {
        expect(SyncTable.SYSTEM_INDEX_FIELDS).toContain("state");
    });

    test("共 3 个系统索引字段", () => {
        expect(SyncTable.SYSTEM_INDEX_FIELDS.length).toBe(3);
    });
});

describe("MYSQL_TABLE_CONFIG", () => {
    test("ENGINE 为 InnoDB", () => {
        expect(SyncTable.MYSQL_TABLE_CONFIG.ENGINE).toBe("InnoDB");
    });

    test("CHARSET 为 utf8mb4", () => {
        expect(SyncTable.MYSQL_TABLE_CONFIG.CHARSET).toBe("utf8mb4");
    });

    test("COLLATE 为 utf8mb4_0900_ai_ci", () => {
        expect(SyncTable.MYSQL_TABLE_CONFIG.COLLATE).toBe("utf8mb4_0900_ai_ci");
    });
});

describe("getSqlType (MySQL)", () => {
    test("number 映射为 BIGINT", () => {
        expect(SyncTable.getSqlType("number", null)).toBe("BIGINT");
    });

    test("string 映射为 VARCHAR", () => {
        expect(SyncTable.getSqlType("string", 100)).toBe("VARCHAR(100)");
    });

    test("datetime 映射为 DATETIME", () => {
        expect(SyncTable.getSqlType("datetime", null)).toBe("DATETIME");
    });

    test("text 映射为 MEDIUMTEXT", () => {
        expect(SyncTable.getSqlType("text", null)).toBe("MEDIUMTEXT");
    });

    test("array_string 映射为 VARCHAR", () => {
        expect(SyncTable.getSqlType("array_string", 50)).toBe("VARCHAR(50)");
    });

    test("array_text 映射为 MEDIUMTEXT", () => {
        expect(SyncTable.getSqlType("array_text", null)).toBe("MEDIUMTEXT");
    });
});
