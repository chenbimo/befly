/**
 * syncTable 辅助工具模块测试
 *
 * 测试 helpers.ts 中的函数：
 * - normalizeFieldDefinitionInPlace
 */

// 类型导入
import type { FieldDefinition } from "../types/validate";

import { describe, test, expect } from "bun:test";

import { SyncTable } from "../sync/syncTable.ts";

describe("normalizeFieldDefinitionInPlace", () => {
    test("为空字段定义应用默认值", () => {
        const fieldDef: FieldDefinition = {
            name: "用户名",
            type: "string"
        };

        SyncTable.normalizeFieldDefinitionInPlace(fieldDef);

        expect(fieldDef.detail).toBe("");
        expect(fieldDef.min).toBe(null);
        expect(fieldDef.max).toBe(null);
        expect(fieldDef.default).toBe(null);
        expect(fieldDef.index).toBe(false);
        expect(fieldDef.unique).toBe(false);
        expect(fieldDef.nullable).toBe(false);
        expect(fieldDef.unsigned).toBe(false);
        expect(fieldDef.regexp).toBe(null);
    });

    test("保留已有值", () => {
        const fieldDef: FieldDefinition = {
            name: "用户名",
            type: "string",
            max: 200,
            index: true,
            unique: true,
            nullable: true
        };

        SyncTable.normalizeFieldDefinitionInPlace(fieldDef);

        expect(fieldDef.max).toBe(200);
        expect(fieldDef.index).toBe(true);
        expect(fieldDef.unique).toBe(true);
        expect(fieldDef.nullable).toBe(true);
    });

    test("处理 0 和 false 值", () => {
        const fieldDef: FieldDefinition = {
            name: "排序",
            type: "number",
            min: 0,
            max: 0,
            default: 0,
            index: false,
            unsigned: false
        };

        SyncTable.normalizeFieldDefinitionInPlace(fieldDef);

        expect(fieldDef.min).toBe(0);
        expect(fieldDef.max).toBe(0);
        expect(fieldDef.default).toBe(0);
        expect(fieldDef.index).toBe(false);
        expect(fieldDef.unsigned).toBe(false);
    });
});
