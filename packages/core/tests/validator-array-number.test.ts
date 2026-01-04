/**
 * 测试 Validator 对 array_number_string 和 array_number_text 类型的支持
 */

import type { FieldDefinition } from "befly/types/validate";

import { describe, expect, test } from "bun:test";

import { Validator } from "../lib/validator.ts";

describe("Validator - array_number 类型验证", () => {
    // ==================== 类型转换测试 ====================

    test("array_number_string: 接受数字数组", () => {
        const field: FieldDefinition = {
            name: "数字数组",
            type: "array_number_string",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single([1, 2, 3], field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual([1, 2, 3]);
    });

    test("array_number_string: 拒绝字符串数组", () => {
        const field: FieldDefinition = {
            name: "数字数组",
            type: "array_number_string",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single(["1", "2", "3"], field);
        expect(result.error).toBe("数组元素必须是数字");
        expect(result.value).toBeNull();
    });

    test("array_number_string: 拒绝混合类型数组", () => {
        const field: FieldDefinition = {
            name: "数字数组",
            type: "array_number_string",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single([1, "2", 3], field);
        expect(result.error).toBe("数组元素必须是数字");
    });

    test("array_number_string: 拒绝非数组值", () => {
        const field: FieldDefinition = {
            name: "数字数组",
            type: "array_number_string",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single("123", field);
        expect(result.error).toBe("必须是数组");
    });

    test("array_number_text: 接受数字数组", () => {
        const field: FieldDefinition = {
            name: "长数字数组",
            type: "array_number_text",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single([100, 200, 300], field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual([100, 200, 300]);
    });

    test("array_number_text: 拒绝 NaN 和 Infinity", () => {
        const field: FieldDefinition = {
            name: "数字数组",
            type: "array_number_text",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result1 = Validator.single([1, NaN, 3], field);
        expect(result1.error).toBe("数组元素必须是数字");

        const result2 = Validator.single([1, Infinity, 3], field);
        expect(result2.error).toBe("数组元素必须是数字");
    });

    // ==================== 规则验证测试 ====================

    test("array_number_string: min 规则验证", () => {
        const field: FieldDefinition = {
            name: "数字数组",
            type: "array_number_string",
            min: 2,
            max: null,
            default: null,
            regexp: null
        };

        const result1 = Validator.single([1], field);
        expect(result1.error).toBe("至少需要2个元素");

        const result2 = Validator.single([1, 2], field);
        expect(result2.error).toBeNull();

        const result3 = Validator.single([1, 2, 3], field);
        expect(result3.error).toBeNull();
    });

    test("array_number_string: max 规则验证", () => {
        const field: FieldDefinition = {
            name: "数字数组",
            type: "array_number_string",
            min: null,
            max: 3,
            default: null,
            regexp: null
        };

        const result1 = Validator.single([1, 2, 3], field);
        expect(result1.error).toBeNull();

        const result2 = Validator.single([1, 2, 3, 4], field);
        expect(result2.error).toBe("最多只能有3个元素");
    });

    test("array_number_text: min + max 规则验证", () => {
        const field: FieldDefinition = {
            name: "长数字数组",
            type: "array_number_text",
            min: 1,
            max: 5,
            default: null,
            regexp: null
        };

        const result1 = Validator.single([], field);
        expect(result1.error).toBe("至少需要1个元素");

        const result2 = Validator.single([1, 2, 3], field);
        expect(result2.error).toBeNull();

        const result3 = Validator.single([1, 2, 3, 4, 5, 6], field);
        expect(result3.error).toBe("最多只能有5个元素");
    });

    // ==================== 默认值测试 ====================

    test("array_number_string: 无 default 时返回空数组", () => {
        const field: FieldDefinition = {
            name: "数字数组",
            type: "array_number_string",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result1 = Validator.single(undefined, field);
        expect(result1.error).toBeNull();
        expect(result1.value).toEqual([]);

        const result2 = Validator.single(null, field);
        expect(result2.error).toBeNull();
        expect(result2.value).toEqual([]);

        const result3 = Validator.single("", field);
        expect(result3.error).toBeNull();
        expect(result3.value).toEqual([]);
    });

    test("array_number_string: 有 default 时返回自定义默认值", () => {
        const field: FieldDefinition = {
            name: "数字数组",
            type: "array_number_string",
            min: null,
            max: null,
            default: [10, 20, 30],
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual([10, 20, 30]);
    });

    test('array_number_string: default 为字符串 "[]" 时返回空数组', () => {
        const field: FieldDefinition = {
            name: "数字数组",
            type: "array_number_string",
            min: null,
            max: null,
            default: "[]",
            regexp: null
        };

        const result = Validator.single(null, field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual([]);
    });

    test("array_number_text: 无 default 时返回空数组", () => {
        const field: FieldDefinition = {
            name: "长数字数组",
            type: "array_number_text",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual([]);
    });

    test("array_number_text: 有 default 时返回自定义默认值", () => {
        const field: FieldDefinition = {
            name: "长数字数组",
            type: "array_number_text",
            min: null,
            max: null,
            default: [100, 200],
            regexp: null
        };

        const result = Validator.single(undefined, field);
        expect(result.error).toBeNull();
        expect(result.value).toEqual([100, 200]);
    });

    // ==================== validate 方法测试 ====================

    test("validate: array_number_string 字段验证", () => {
        const rules = {
            tags: {
                name: "标签ID",
                type: "array_number_string",
                min: 1,
                max: 10,
                default: null,
                regexp: null
            }
        };

        const result1 = Validator.validate({ tags: [1, 2, 3] }, rules as any, ["tags"]);
        expect(result1.failed).toBe(false);

        const result2 = Validator.validate({ tags: [] }, rules as any, ["tags"]);
        expect(result2.failed).toBe(true);
        expect(result2.firstError).toBe("标签ID至少需要1个元素");

        const result3 = Validator.validate({ tags: ["1", "2"] }, rules as any, ["tags"]);
        expect(result3.failed).toBe(true);
        expect(result3.firstError).toBe("标签ID数组元素必须是数字");
    });

    test("validate: array_number_text 字段验证", () => {
        const rules = {
            ids: {
                name: "关联ID",
                type: "array_number_text",
                min: null,
                max: null,
                default: null,
                regexp: null
            }
        };

        const result1 = Validator.validate({ ids: [100, 200, 300] }, rules as any, []);
        expect(result1.failed).toBe(false);

        const result2 = Validator.validate({ ids: "not-array" }, rules as any, []);
        expect(result2.failed).toBe(true);
        expect(result2.firstError).toBe("关联ID必须是数组");
    });

    test("validate: undefined 参数跳过验证", () => {
        const rules = {
            tags: {
                name: "标签",
                type: "array_number_string",
                min: 1,
                max: null,
                default: null,
                regexp: null
            }
        };

        // undefined 且不是必填字段，应跳过验证
        const result = Validator.validate({ other: "value" }, rules as any, []);
        expect(result.failed).toBe(false);
    });
});
