/**
 * syncTable 变更应用模块测试
 *
 * 测试 apply.ts 中的函数：
 * - compareFieldDefinition
 */

import type { ColumnInfo } from "../types/sync.ts";
import type { FieldDefinition } from "../types/validate.ts";

import { describe, test, expect } from "bun:test";

import { syncTable } from "../sync/syncTable.ts";

type ExistingColumn = Pick<ColumnInfo, "type" | "max" | "nullable" | "defaultValue" | "comment">;

describe("compareFieldDefinition", () => {
    describe("长度变化检测", () => {
        test("string 类型长度变化被检测到", () => {
            const existingColumn = {
                type: "varchar",
                max: 50,
                nullable: false,
                defaultValue: "",
                comment: "用户名"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "用户名",
                type: "string",
                max: 100,
                nullable: false,
                default: null
            } satisfies FieldDefinition;

            const changes = syncTable.TestKit.compareFieldDefinition("mysql", existingColumn, fieldDef);
            const lengthChange = changes.find((c) => c.type === "length");

            expect(lengthChange).toBeDefined();
            expect(lengthChange.current).toBe(50);
            expect(lengthChange.expected).toBe(100);
        });

        test("长度相同无变化", () => {
            const existingColumn = {
                type: "varchar",
                max: 100,
                nullable: false,
                defaultValue: "",
                comment: "用户名"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "用户名",
                type: "string",
                max: 100,
                nullable: false,
                default: null
            } satisfies FieldDefinition;

            const changes = syncTable.TestKit.compareFieldDefinition("mysql", existingColumn, fieldDef);
            const lengthChange = changes.find((c) => c.type === "length");

            expect(lengthChange).toBeUndefined();
        });
    });

    describe("注释变化检测", () => {
        test("注释变化被检测到", () => {
            const existingColumn = {
                type: "varchar",
                max: 100,
                nullable: false,
                defaultValue: "",
                comment: "旧注释"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "新注释",
                type: "string",
                max: 100,
                nullable: false,
                default: null
            } satisfies FieldDefinition;

            const changes = syncTable.TestKit.compareFieldDefinition("mysql", existingColumn, fieldDef);
            const commentChange = changes.find((c) => c.type === "comment");

            expect(commentChange).toBeDefined();
            expect(commentChange.current).toBe("旧注释");
            expect(commentChange.expected).toBe("新注释");
        });

        test("注释相同无变化", () => {
            const existingColumn = {
                type: "varchar",
                max: 100,
                nullable: false,
                defaultValue: "",
                comment: "用户名"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "用户名",
                type: "string",
                max: 100,
                nullable: false,
                default: null
            } satisfies FieldDefinition;

            const changes = syncTable.TestKit.compareFieldDefinition("mysql", existingColumn, fieldDef);
            const commentChange = changes.find((c) => c.type === "comment");

            expect(commentChange).toBeUndefined();
        });
    });

    describe("数据类型变化检测", () => {
        test("类型变化被检测到", () => {
            const existingColumn = {
                type: "bigint",
                max: null,
                nullable: false,
                defaultValue: 0,
                comment: "数量"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "数量",
                type: "string",
                max: 100,
                nullable: false,
                default: null
            } satisfies FieldDefinition;

            const changes = syncTable.TestKit.compareFieldDefinition("mysql", existingColumn, fieldDef);
            const typeChange = changes.find((c) => c.type === "datatype");

            expect(typeChange).toBeDefined();
            expect(typeChange.current).toBe("bigint");
            expect(typeChange.expected).toBe("varchar");
        });

        test("类型相同无变化", () => {
            const existingColumn = {
                type: "bigint",
                max: null,
                nullable: false,
                defaultValue: 0,
                comment: "数量"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "数量",
                type: "number",
                max: null,
                nullable: false,
                default: 0
            } satisfies FieldDefinition;

            const changes = syncTable.TestKit.compareFieldDefinition("mysql", existingColumn, fieldDef);
            const typeChange = changes.find((c) => c.type === "datatype");

            expect(typeChange).toBeUndefined();
        });
    });

    describe("可空性变化检测", () => {
        test("nullable 变化被检测到", () => {
            const existingColumn = {
                type: "varchar",
                max: 100,
                nullable: false,
                defaultValue: "",
                comment: "用户名"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "用户名",
                type: "string",
                max: 100,
                nullable: true,
                default: null
            } satisfies FieldDefinition;

            const changes = syncTable.TestKit.compareFieldDefinition("mysql", existingColumn, fieldDef);
            const nullableChange = changes.find((c) => c.type === "nullable");

            expect(nullableChange).toBeDefined();
            expect(nullableChange.current).toBe(false);
            expect(nullableChange.expected).toBe(true);
        });
    });

    describe("默认值变化检测", () => {
        test("默认值变化被检测到", () => {
            const existingColumn = {
                type: "varchar",
                max: 100,
                nullable: false,
                defaultValue: "old",
                comment: "用户名"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "用户名",
                type: "string",
                max: 100,
                nullable: false,
                default: "new"
            } satisfies FieldDefinition;

            const changes = syncTable.TestKit.compareFieldDefinition("mysql", existingColumn, fieldDef);
            const defaultChange = changes.find((c) => c.type === "default");

            expect(defaultChange).toBeDefined();
            expect(defaultChange.current).toBe("old");
            expect(defaultChange.expected).toBe("new");
        });

        test("null 默认值被正确处理", () => {
            const existingColumn = {
                type: "varchar",
                max: 100,
                nullable: false,
                defaultValue: "",
                comment: "用户名"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "用户名",
                type: "string",
                max: 100,
                nullable: false,
                default: null // null 会被解析为空字符串
            } satisfies FieldDefinition;

            const changes = syncTable.TestKit.compareFieldDefinition("mysql", existingColumn, fieldDef);
            const defaultChange = changes.find((c) => c.type === "default");

            // null -> '' (空字符串)，与现有值相同，无变化
            expect(defaultChange).toBeUndefined();
        });
    });

    describe("多变化组合", () => {
        test("多个变化同时被检测", () => {
            const existingColumn = {
                type: "varchar",
                max: 50,
                nullable: false,
                defaultValue: "old",
                comment: "旧注释"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "新注释",
                type: "string",
                max: 100,
                nullable: true,
                default: "new"
            } satisfies FieldDefinition;

            const changes = syncTable.TestKit.compareFieldDefinition("mysql", existingColumn, fieldDef);

            expect(changes.length).toBe(4); // length, comment, nullable, default
            expect(changes.some((c) => c.type === "length")).toBe(true);
            expect(changes.some((c) => c.type === "comment")).toBe(true);
            expect(changes.some((c) => c.type === "nullable")).toBe(true);
            expect(changes.some((c) => c.type === "default")).toBe(true);
        });

        test("无变化返回空数组", () => {
            const existingColumn = {
                type: "varchar",
                max: 100,
                nullable: false,
                defaultValue: "",
                comment: "用户名"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "用户名",
                type: "string",
                max: 100,
                nullable: false,
                default: null
            } satisfies FieldDefinition;

            const changes = syncTable.TestKit.compareFieldDefinition("mysql", existingColumn, fieldDef);

            expect(changes.length).toBe(0);
        });
    });
});
