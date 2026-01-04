/**
 * 测试 Validator 的默认值处理逻辑
 */

import type { FieldDefinition } from "befly/types/validate";

import { describe, expect, test } from "bun:test";

import { Validator } from "../lib/validator.ts";

describe("Validator - 默认值处理逻辑", () => {
    // ==================== number 类型默认值 ====================

    test("number: 无 default 时返回 0", () => {
        const field: FieldDefinition = {
            name: "数字",
            type: "number",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toBe(0);
    });

    test("number: 有 default 时返回自定义值", () => {
        const field: FieldDefinition = {
            name: "数字",
            type: "number",
            min: null,
            max: null,
            default: 100,
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toBe(100);
    });

    test("number: default 为字符串时自动转换", () => {
        const field: FieldDefinition = {
            name: "数字",
            type: "number",
            min: null,
            max: null,
            default: "999",
            regexp: null
        };

        const result = Validator.single(null, field);
        expect(result.error).toBeNull();
        expect(result.value).toBe(999);
    });

    test("number: default 为无效字符串时返回 0", () => {
        const field: FieldDefinition = {
            name: "数字",
            type: "number",
            min: null,
            max: null,
            default: "invalid",
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toBe(0);
    });

    // ==================== string 类型默认值 ====================

    test("string: 无 default 时返回空字符串", () => {
        const field: FieldDefinition = {
            name: "字符串",
            type: "string",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toBe("");
    });

    test("string: 有 default 时返回自定义值", () => {
        const field: FieldDefinition = {
            name: "字符串",
            type: "string",
            min: null,
            max: null,
            default: "admin",
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toBe("admin");
    });

    // ==================== text 类型默认值 ====================

    test("text: 无 default 时返回空字符串", () => {
        const field: FieldDefinition = {
            name: "文本",
            type: "text",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toBe("");
    });

    test("text: 有 default 时返回自定义值", () => {
        const field: FieldDefinition = {
            name: "文本",
            type: "text",
            min: null,
            max: null,
            default: "这是长文本内容",
            regexp: null
        };

        const result = Validator.single(null, field);
        expect(result.error).toBeNull();
        expect(result.value).toBe("这是长文本内容");
    });

    // ==================== array_string 类型默认值 ====================

    test("array_string: 无 default 时返回空数组", () => {
        const field: FieldDefinition = {
            name: "字符串数组",
            type: "array_string",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual([]);
    });

    test("array_string: 有 default 时返回自定义数组", () => {
        const field: FieldDefinition = {
            name: "字符串数组",
            type: "array_string",
            min: null,
            max: null,
            default: ["a", "b", "c"],
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual(["a", "b", "c"]);
    });

    test('array_string: default 为字符串 "[]" 时返回空数组', () => {
        const field: FieldDefinition = {
            name: "字符串数组",
            type: "array_string",
            min: null,
            max: null,
            default: "[]",
            regexp: null
        };

        const result = Validator.single(null, field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual([]);
    });

    test("array_string: default 为 JSON 字符串时解析为数组", () => {
        const field: FieldDefinition = {
            name: "字符串数组",
            type: "array_string",
            min: null,
            max: null,
            default: '["x", "y", "z"]',
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual(["x", "y", "z"]);
    });

    test("array_string: default 为无效 JSON 时返回空数组", () => {
        const field: FieldDefinition = {
            name: "字符串数组",
            type: "array_string",
            min: null,
            max: null,
            default: "invalid-json",
            regexp: null
        };

        const result = Validator.single(null, field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual([]);
    });

    // ==================== array_text 类型默认值 ====================

    test("array_text: 无 default 时返回空数组", () => {
        const field: FieldDefinition = {
            name: "文本数组",
            type: "array_text",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual([]);
    });

    test("array_text: 有 default 时返回自定义数组", () => {
        const field: FieldDefinition = {
            name: "文本数组",
            type: "array_text",
            min: null,
            max: null,
            default: ["长文本1", "长文本2"],
            regexp: null
        };

        const result = Validator.single(null, field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual(["长文本1", "长文本2"]);
    });

    // ==================== 空值处理测试 ====================

    test("undefined 应使用默认值", () => {
        const field: FieldDefinition = {
            name: "测试",
            type: "string",
            min: null,
            max: null,
            default: "test",
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toBe("test");
    });

    test("null 应使用默认值", () => {
        const field: FieldDefinition = {
            name: "测试",
            type: "number",
            min: null,
            max: null,
            default: 999,
            regexp: null
        };

        const result = Validator.single(null, field);
        expect(result.error).toBeNull();
        expect(result.value).toBe(999);
    });

    test("空字符串应使用默认值", () => {
        const field: FieldDefinition = {
            name: "测试",
            type: "string",
            min: null,
            max: null,
            default: "fallback",
            regexp: null
        };

        const result = Validator.single("", field);
        expect(result.error).toBeNull();
        expect(result.value).toBe("fallback");
    });

    // ==================== 默认值优先级测试 ====================

    test("字段 default 应覆盖类型默认值（number）", () => {
        const fieldWithDefault: FieldDefinition = {
            name: "数字",
            type: "number",
            min: null,
            max: null,
            default: 888,
            regexp: null
        };

        const fieldWithoutDefault: FieldDefinition = {
            name: "数字",
            type: "number",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result1 = Validator.single(undefined, fieldWithDefault);
        expect(result1.value).toBe(888); // 使用字段 default

        const result2 = Validator.single(undefined, fieldWithoutDefault);
        expect(result2.value).toBe(0); // 使用类型默认值
    });

    test("字段 default 应覆盖类型默认值（string）", () => {
        const fieldWithDefault: FieldDefinition = {
            name: "字符串",
            type: "string",
            min: null,
            max: null,
            default: "custom",
            regexp: null
        };

        const fieldWithoutDefault: FieldDefinition = {
            name: "字符串",
            type: "string",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result1 = Validator.single(undefined, fieldWithDefault);
        expect(result1.value).toBe("custom"); // 使用字段 default

        const result2 = Validator.single(undefined, fieldWithoutDefault);
        expect(result2.value).toBe(""); // 使用类型默认值
    });

    test("字段 default 应覆盖类型默认值（array）", () => {
        const fieldWithDefault: FieldDefinition = {
            name: "数组",
            type: "array_number_string",
            min: null,
            max: null,
            default: [1, 2, 3],
            regexp: null
        };

        const fieldWithoutDefault: FieldDefinition = {
            name: "数组",
            type: "array_number_string",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result1 = Validator.single(undefined, fieldWithDefault);
        expect(result1.value).toEqual([1, 2, 3]); // 使用字段 default

        const result2 = Validator.single(undefined, fieldWithoutDefault);
        expect(result2.value).toEqual([]); // 使用类型默认值
    });
});
