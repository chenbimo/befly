/**
 * 测试 Validator 对 datetime 类型的支持（MySQL DATETIME，精度到秒）
 */

import type { FieldDefinition, TableDefinition } from "befly/types/validate";

import { describe, expect, test } from "bun:test";

import { Validator } from "../lib/validator.ts";

describe("Validator - datetime 类型验证", () => {
    test("single: 接受 YYYY-MM-DD HH:mm:ss 格式字符串", () => {
        const field: FieldDefinition = {
            name: "创建时间",
            type: "datetime",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single("2026-01-15 12:34:56", field);
        expect(result.error).toBeNull();
        expect(result.value).toBe("2026-01-15 12:34:56");
    });

    test("single: 拒绝不符合格式的字符串", () => {
        const field: FieldDefinition = {
            name: "创建时间",
            type: "datetime",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single("2026-1-15 12:34:56", field);
        expect(result.error).toBe("格式不正确");
        expect(result.value).toBeNull();
    });

    test("single: 非字符串被拒绝", () => {
        const field: FieldDefinition = {
            name: "创建时间",
            type: "datetime",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const result = Validator.single(123, field);
        expect(result.error).toBe("必须是时间字符串");
        expect(result.value).toBeNull();
    });

    test("single: 缺失值时默认返回 null", () => {
        const field: FieldDefinition = {
            name: "创建时间",
            type: "datetime",
            min: null,
            max: null,
            default: null,
            regexp: null
        };

        const r1 = Validator.single(undefined, field);
        expect(r1.error).toBeNull();
        expect(r1.value).toBeNull();

        const r2 = Validator.single(null, field);
        expect(r2.error).toBeNull();
        expect(r2.value).toBeNull();

        const r3 = Validator.single("", field);
        expect(r3.error).toBeNull();
        expect(r3.value).toBeNull();
    });

    test("validate: required + datetime 缺失时报错", () => {
        const rules: TableDefinition = {
            createdAt: {
                name: "创建时间",
                type: "datetime",
                min: null,
                max: null,
                default: null,
                regexp: null
            }
        };

        const result = Validator.validate({}, rules, ["createdAt"]);
        expect(result.failed).toBe(true);
        expect(result.errorFields).toEqual(["createdAt"]);
        expect(result.fieldErrors.createdAt).toBe("创建时间为必填项");
    });

    test("validate: datetime 值不合法时报错", () => {
        const rules: TableDefinition = {
            createdAt: {
                name: "创建时间",
                type: "datetime",
                min: null,
                max: null,
                default: null,
                regexp: null
            }
        };

        const result = Validator.validate({ createdAt: "bad" }, rules, []);
        expect(result.failed).toBe(true);
        expect(result.fieldErrors.createdAt).toBe("创建时间格式不正确");
    });
});
