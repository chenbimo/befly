/**
 * syncTable 变更应用模块测试
 *
 * 测试 apply.ts 中的函数：
 * - compareFieldDefinition
 */

import type { ColumnInfo } from "../types/sync.ts";
import type { FieldDefinition } from "../types/validate.ts";

import { describe, test, expect } from "bun:test";

import { SyncTable } from "../sync/syncTable.ts";

type ExistingColumn = Pick<ColumnInfo, "type" | "max" | "nullable" | "defaultValue" | "comment"> & { columnType?: string };

describe("compareFieldDefinition", () => {
    describe("类型变化检测（包含长度变化）", () => {
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
                type: "varchar",
                input: "string",
                max: 100,
                nullable: false,
                default: null
            } satisfies FieldDefinition;

            const changes = SyncTable.compareFieldDefinition(existingColumn, fieldDef);
            const typeChange = changes.find((c) => c.type === "datatype");

            expect(typeChange).toBeDefined();
            expect(typeChange.current).toBe("varchar(50)");
            expect(typeChange.expected).toBe("varchar(100)");
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
                type: "varchar",
                input: "string",
                max: 100,
                nullable: false,
                default: null
            } satisfies FieldDefinition;

            const changes = SyncTable.compareFieldDefinition(existingColumn, fieldDef);
            const typeChange = changes.find((c) => c.type === "datatype");

            expect(typeChange).toBeUndefined();
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
                type: "varchar",
                input: "string",
                max: 100,
                nullable: false,
                default: null
            } satisfies FieldDefinition;

            const changes = SyncTable.compareFieldDefinition(existingColumn, fieldDef);
            const typeChange = changes.find((c) => c.type === "datatype");

            expect(typeChange).toBeDefined();
            expect(typeChange.current).toBe("bigint");
            expect(typeChange.expected).toBe("varchar(100)");
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
                type: "bigint",
                input: "number",
                max: null,
                nullable: false,
                default: 0
            } satisfies FieldDefinition;

            const changes = SyncTable.compareFieldDefinition(existingColumn, fieldDef);
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
                type: "varchar",
                input: "string",
                max: 100,
                nullable: true,
                default: null
            } satisfies FieldDefinition;

            const changes = SyncTable.compareFieldDefinition(existingColumn, fieldDef);
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
                type: "varchar",
                input: "string",
                max: 100,
                nullable: false,
                default: "new"
            } satisfies FieldDefinition;

            const changes = SyncTable.compareFieldDefinition(existingColumn, fieldDef);
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
                type: "varchar",
                input: "string",
                max: 100,
                nullable: false,
                default: null // null 会被解析为空字符串
            } satisfies FieldDefinition;

            const changes = SyncTable.compareFieldDefinition(existingColumn, fieldDef);
            const defaultChange = changes.find((c) => c.type === "default");

            // null -> '' (空字符串)，与现有值相同，无变化
            expect(defaultChange).toBeUndefined();
        });
    });

    describe("decimal / datetime 比较", () => {
        test("decimal 默认值等价时不应变化", () => {
            const existingColumn = {
                type: "decimal",
                columnType: "decimal(10,2)",
                max: null,
                nullable: false,
                defaultValue: "0.00",
                comment: "金额"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "金额",
                type: "decimal",
                input: "number",
                precision: 10,
                scale: 2,
                max: null,
                nullable: false,
                default: 0
            } satisfies FieldDefinition;

            const changes = SyncTable.compareFieldDefinition(existingColumn, fieldDef);

            expect(changes.length).toBe(0);
        });

        test("datetime 默认值为空时不应变化", () => {
            const existingColumn = {
                type: "datetime",
                columnType: "datetime",
                max: null,
                nullable: false,
                defaultValue: null,
                comment: "创建时间"
            } satisfies ExistingColumn;
            const fieldDef = {
                name: "创建时间",
                type: "datetime",
                input: "string",
                max: null,
                nullable: false,
                default: null
            } satisfies FieldDefinition;

            const changes = SyncTable.compareFieldDefinition(existingColumn, fieldDef);

            expect(changes.length).toBe(0);
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
                type: "varchar",
                input: "string",
                max: 100,
                nullable: true,
                default: "new"
            } satisfies FieldDefinition;

            const changes = SyncTable.compareFieldDefinition(existingColumn, fieldDef);

            expect(changes.length).toBe(3); // datatype, nullable, default
            expect(changes.some((c) => c.type === "datatype")).toBe(true);
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
                type: "varchar",
                input: "string",
                max: 100,
                nullable: false,
                default: null
            } satisfies FieldDefinition;

            const changes = SyncTable.compareFieldDefinition(existingColumn, fieldDef);

            expect(changes.length).toBe(0);
        });
    });
});
