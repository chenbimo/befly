import type { ScanFileResult } from "../utils/scanFiles.js";

import { describe, expect, test } from "bun:test";

import { checkTable } from "../checks/checkTable.js";
import { Logger } from "../lib/logger.js";

describe("checkTable - smoke", () => {
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
                content: {
                    customerName: { name: "客户名", type: "string", max: 32 }
                }
            } as any
        ];

        await checkTable(items);
        expect(true).toBe(true);
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
            await checkTable([
                {
                    type: "table",
                    source: "app",
                    filePath: "DUMMY",
                    relativePath: "TestCustomers",
                    fileName: "TestCustomers",
                    moduleName: "app_TestCustomers",
                    content: {}
                } as any
            ]);
        } catch {
            // 触发 hasError 后会抛错：这里只验证日志前缀
        } finally {
            Logger.setMock(null);
        }

        const warnMessages = calls.filter((item) => item.level === "warn").map((item) => String(item.args[0]));

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
            await checkTable([
                {
                    type: "table",
                    source: "app",
                    sourceName: 123,
                    filePath: "DUMMY",
                    relativePath: "TestCustomers",
                    fileName: "TestCustomers",
                    moduleName: "app_TestCustomers",
                    content: {}
                } as any
            ]);
        } catch {
            // 触发 hasError 后会抛错：这里只验证日志前缀
        } finally {
            Logger.setMock(null);
        }

        const warnMessages = calls.filter((item) => item.level === "warn").map((item) => String(item.args[0]));

        expect(warnMessages.some((msg) => msg.includes("表 TestCustomers"))).toBe(true);
        expect(warnMessages.some((msg) => msg.includes("undefined表"))).toBe(false);
    });
});
