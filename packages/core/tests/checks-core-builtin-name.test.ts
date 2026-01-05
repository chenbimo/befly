import { test, expect } from "bun:test";

import { checkHook } from "../checks/checkHook";
import { checkPlugin } from "../checks/checkPlugin";

test("checkHook: core builtin name 必须是小写字母+下划线", async () => {
    let thrown: any = null;

    try {
        await checkHook([
            {
                source: "core",
                // 非 snake_case（驼峰 + 大写）
                name: "RateLimit",
                moduleName: "RateLimit",
                filePath: "core:hook:RateLimit",
                enable: true,
                deps: [],
                handler: async () => {}
            }
        ]);
    } catch (error: any) {
        thrown = error;
    }

    expect(thrown).toBeTruthy();
    expect(String(thrown?.message || "").includes("钩子结构检查失败")).toBe(true);
});

test("checkPlugin: core builtin name 必须是小写字母+下划线", async () => {
    let thrown: any = null;

    try {
        await checkPlugin([
            {
                source: "core",
                // 非 snake_case（包含空格）
                name: "redis cache",
                moduleName: "redis cache",
                filePath: "core:plugin:redis cache",
                enable: true,
                deps: [],
                handler: async () => {}
            }
        ]);
    } catch (error: any) {
        thrown = error;
    }

    expect(thrown).toBeTruthy();
    expect(String(thrown?.message || "").includes("插件结构检查失败")).toBe(true);
});
