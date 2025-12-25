import type { ScanFileResult } from "../utils/scanFiles.js";

import { describe, expect, test } from "bun:test";

import { checkTable } from "../checks/checkTable.js";

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
});
