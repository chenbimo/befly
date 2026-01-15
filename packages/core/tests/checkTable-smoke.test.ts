import type { ScanFileResult } from "../utils/scanFiles.ts";

import { describe, expect, test } from "bun:test";

import { checkTable } from "../checks/checkTable.ts";
import { Logger } from "../lib/logger.ts";

describe("checkTable - smoke", () => {
    const defaultConfig = { strict: true };
    const getMsgFromArgs = (args: unknown[]): string => {
        const first = args[0];

        if (typeof first === "string") {
            return first;
        }

        if (typeof first === "object" && first !== null) {
            const record = first as any;
            if (typeof record.msg === "string") {
                return record.msg;
            }
        }

        return String(first);
    };

    test("应忽略非 table 项；合法表定义不应抛错", async () => {
        const items: ScanFileResult[] = [
            {
                type: "api",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "DUMMY",
                fileName: "dummy",
                moduleName: "app_dummy",
                addonName: "",
                content: {}
            } as any,
            {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testCustomers",
                fileName: "testCustomers",
                moduleName: "app_testCustomers",
                addonName: "",
                content: {
                    customerName: { name: "客户名", type: "varchar", max: 32 }
                }
            } as any
        ];

        await checkTable(items, defaultConfig);
        expect(true).toBe(true);
    });

    test("decimal 字段完整配置不应抛错", async () => {
        const items: ScanFileResult[] = [
            {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testOrderPrice",
                fileName: "testOrderPrice",
                moduleName: "app_testOrderPrice",
                addonName: "",
                content: {
                    amount: {
                        name: "金额",
                        type: "decimal",
                        input: "number",
                        precision: 12,
                        scale: 2,
                        default: 0,
                        nullable: false,
                        unsigned: true
                    },
                    discountRate: {
                        name: "折扣率",
                        type: "decimal",
                        input: "number",
                        precision: 5,
                        scale: 4,
                        default: null,
                        nullable: true,
                        unsigned: true
                    }
                }
            } as any
        ];

        await checkTable(items, defaultConfig);
        expect(true).toBe(true);
    });

    test("decimal precision/scale 上限配置不应抛错", async () => {
        const items: ScanFileResult[] = [
            {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testDecimalMax",
                fileName: "testDecimalMax",
                moduleName: "app_testDecimalMax",
                addonName: "",
                content: {
                    amount: {
                        name: "金额",
                        type: "decimal",
                        input: "number",
                        precision: 65,
                        scale: 30,
                        default: 0,
                        nullable: false,
                        unsigned: true
                    }
                }
            } as any
        ];

        await checkTable(items, defaultConfig);
        expect(true).toBe(true);
    });

    test("decimal precision/scale 非法时应阻断启动（抛错）", async () => {
        const items: ScanFileResult[] = [
            {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testDecimalInvalid",
                fileName: "testDecimalInvalid",
                moduleName: "app_testDecimalInvalid",
                addonName: "",
                content: {
                    amount: {
                        name: "金额",
                        type: "decimal",
                        input: "number",
                        precision: 0,
                        scale: 2,
                        default: 0,
                        nullable: false,
                        unsigned: true
                    }
                }
            } as any
        ];

        let thrownError: any = null;
        try {
            await checkTable(items, defaultConfig);
        } catch (error: any) {
            thrownError = error;
        }

        expect(Boolean(thrownError)).toBe(true);
        expect(String(thrownError?.message || "")).toContain("表结构检查失败");
    });

    test("decimal scale 大于 precision 时应阻断启动（抛错）", async () => {
        const items: ScanFileResult[] = [
            {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testDecimalScale",
                fileName: "testDecimalScale",
                moduleName: "app_testDecimalScale",
                addonName: "",
                content: {
                    amount: {
                        name: "金额",
                        type: "decimal",
                        input: "number",
                        precision: 8,
                        scale: 9,
                        default: 0,
                        nullable: false,
                        unsigned: true
                    }
                }
            } as any
        ];

        let thrownError: any = null;
        try {
            await checkTable(items, defaultConfig);
        } catch (error: any) {
            thrownError = error;
        }

        expect(Boolean(thrownError)).toBe(true);
        expect(String(thrownError?.message || "")).toContain("表结构检查失败");
    });

    test("strict=false 时应跳过字段名称正则校验（不应抛错）", async () => {
        const items: ScanFileResult[] = [
            {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testInvalidFieldName",
                fileName: "testInvalidFieldName",
                moduleName: "app_testInvalidFieldName",
                addonName: "",
                content: {
                    title: { name: "标题@", type: "varchar", max: 32 }
                }
            } as any
        ];

        await checkTable(items, { strict: false });
        expect(true).toBe(true);
    });

    test("strict=true 时字段名称非法应阻断启动（抛错）", async () => {
        const items: ScanFileResult[] = [
            {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testInvalidFieldNameStrict",
                fileName: "testInvalidFieldNameStrict",
                moduleName: "app_testInvalidFieldNameStrict",
                addonName: "",
                content: {
                    title: { name: "标题@", type: "varchar", max: 32 }
                }
            } as any
        ];

        let thrownError: any = null;
        try {
            await checkTable(items, { strict: true });
        } catch (error: any) {
            thrownError = error;
        }

        expect(Boolean(thrownError)).toBe(true);
        expect(String(thrownError?.message || "")).toContain("表结构检查失败");
    });

    test("unique 和 index 同时为 true 时应阻断启动（抛错）", async () => {
        const items: ScanFileResult[] = [
            {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testMenu",
                fileName: "testMenu",
                moduleName: "app_testMenu",
                addonName: "",
                content: {
                    path: { name: "路径", type: "varchar", max: 128, unique: true, index: true }
                }
            } as any
        ];

        let thrownError: any = null;
        try {
            await checkTable(items, defaultConfig);
        } catch (error: any) {
            thrownError = error;
        }

        expect(Boolean(thrownError)).toBe(true);
        expect(String(thrownError?.message || "")).toContain("表结构检查失败");
    });

    test("varchar 类型缺失 max 时应阻断启动（抛错）", async () => {
        const items: ScanFileResult[] = [
            {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testStringNoMax",
                fileName: "testStringNoMax",
                moduleName: "app_testStringNoMax",
                addonName: "",
                content: {
                    title: { name: "标题", type: "varchar" }
                }
            } as any
        ];

        let thrownError: any = null;
        try {
            await checkTable(items, defaultConfig);
        } catch (error: any) {
            thrownError = error;
        }

        expect(Boolean(thrownError)).toBe(true);
        expect(String(thrownError?.message || "")).toContain("表结构检查失败");
    });

    test("varchar 类型 max 超出 VARCHAR 上限时应阻断启动（抛错）", async () => {
        const items: ScanFileResult[] = [
            {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testStringMaxTooLarge",
                fileName: "testStringMaxTooLarge",
                moduleName: "app_testStringMaxTooLarge",
                addonName: "",
                content: {
                    title: { name: "标题", type: "varchar", max: 20000 }
                }
            } as any
        ];

        let thrownError: any = null;
        try {
            await checkTable(items, defaultConfig);
        } catch (error: any) {
            thrownError = error;
        }

        expect(Boolean(thrownError)).toBe(true);
        expect(String(thrownError?.message || "")).toContain("表结构检查失败");
    });

    test("index=true 的 varchar 字段 max>500 时应阻断启动（抛错）", async () => {
        const items: ScanFileResult[] = [
            {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testLongIndex",
                fileName: "testLongIndex",
                moduleName: "app_testLongIndex",
                addonName: "",
                content: {
                    code: { name: "编码", type: "varchar", max: 501, index: true }
                }
            } as any
        ];

        let thrownError: any = null;
        try {
            await checkTable(items, defaultConfig);
        } catch (error: any) {
            thrownError = error;
        }

        expect(Boolean(thrownError)).toBe(true);
        expect(String(thrownError?.message || "")).toContain("表结构检查失败");
    });

    test("unique=true 的 varchar 字段 max>180 时应阻断启动（抛错）", async () => {
        const items: ScanFileResult[] = [
            {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testLongUnique",
                fileName: "testLongUnique",
                moduleName: "app_testLongUnique",
                addonName: "",
                content: {
                    code: { name: "编码", type: "varchar", max: 181, unique: true }
                }
            } as any
        ];

        let thrownError: any = null;
        try {
            await checkTable(items, defaultConfig);
        } catch (error: any) {
            thrownError = error;
        }

        expect(Boolean(thrownError)).toBe(true);
        expect(String(thrownError?.message || "")).toContain("表结构检查失败");
    });

    test("sourceName 缺失时：日志不应出现 undefined表（允许前缀为空）", async () => {
        const calls: Array<{ level: string; args: unknown[] }> = [];
        const mockLogger = {
            info(...args: unknown[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: unknown[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: unknown[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: unknown[]) {
                calls.push({ level: "debug", args: args });
            }
        } as any;

        Logger.setMock(mockLogger);

        try {
            await checkTable(
                [
                    {
                        type: "table",
                        source: "app",
                        filePath: "DUMMY",
                        relativePath: "TestCustomers",
                        fileName: "TestCustomers",
                        moduleName: "app_TestCustomers",
                        addonName: "",
                        content: {}
                    } as any
                ],
                defaultConfig
            );
        } catch {
            // 触发 hasError 后会抛错：这里只验证日志前缀
        } finally {
            Logger.setMock(null);
        }

        const warnMessages = calls.filter((item) => item.level === "warn").map((item) => getMsgFromArgs(item.args));

        expect(warnMessages.some((msg) => msg.includes("表 TestCustomers"))).toBe(true);
        expect(warnMessages.some((msg) => msg.includes("undefined表"))).toBe(false);
    });

    test("sourceName 非字符串时：日志不应出现 undefined表（允许前缀为空）", async () => {
        const calls: Array<{ level: string; args: unknown[] }> = [];
        const mockLogger = {
            info(...args: unknown[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: unknown[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: unknown[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: unknown[]) {
                calls.push({ level: "debug", args: args });
            }
        } as any;

        Logger.setMock(mockLogger);

        try {
            await checkTable(
                [
                    {
                        type: "table",
                        source: "app",
                        sourceName: 123,
                        filePath: "DUMMY",
                        relativePath: "TestCustomers",
                        fileName: "TestCustomers",
                        moduleName: "app_TestCustomers",
                        addonName: "",
                        content: {}
                    } as any
                ],
                defaultConfig
            );
        } catch {
            // 触发 hasError 后会抛错：这里只验证日志前缀
        } finally {
            Logger.setMock(null);
        }

        const warnMessages = calls.filter((item) => item.level === "warn").map((item) => getMsgFromArgs(item.args));

        expect(warnMessages.some((msg) => msg.includes("表 TestCustomers"))).toBe(true);
        expect(warnMessages.some((msg) => msg.includes("undefined表"))).toBe(false);
    });
});
