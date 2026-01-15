/**
 * syncTable 基础字段类型测试（varchar/mediumtext）
 */

import { describe, expect, test } from "bun:test";

import { SyncTable } from "../sync/syncTable.ts";

describe("syncTable - varchar/mediumtext 基础行为", () => {
    test("isStringOrArrayType: varchar 需要长度", () => {
        expect(SyncTable.isStringOrArrayType("varchar")).toBe(true);
    });

    test("isStringOrArrayType: mediumtext 不需要长度", () => {
        expect(SyncTable.isStringOrArrayType("mediumtext")).toBe(false);
    });

    test("getSqlType: varchar 生成 VARCHAR(max)", () => {
        const sqlType = SyncTable.getSqlType("varchar", 500);
        expect(sqlType).toMatch(/VARCHAR\(500\)/i);
    });

    test("getSqlType: mediumtext 生成 MEDIUMTEXT", () => {
        const sqlType = SyncTable.getSqlType("mediumtext", null);
        expect(sqlType).toMatch(/MEDIUMTEXT/i);
    });

    test("resolveDefaultValue: varchar null 时返回空字符串", () => {
        const result = SyncTable.resolveDefaultValue(null, "varchar");
        expect(result).toBe("");
    });

    test("resolveDefaultValue: mediumtext null 时返回 null", () => {
        const result = SyncTable.resolveDefaultValue(null, "mediumtext");
        expect(result).toBe("null");
    });

    test("generateDefaultSql: varchar 生成 DEFAULT 子句", () => {
        const sql = SyncTable.generateDefaultSql("ok", "varchar");
        expect(sql).toBe(" DEFAULT 'ok'");
    });

    test("generateDefaultSql: mediumtext 不生成 DEFAULT", () => {
        const sql = SyncTable.generateDefaultSql("null", "mediumtext");
        expect(sql).toBe("");
    });
});
