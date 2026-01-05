import { test, expect } from "bun:test";

import { scanFiles } from "../utils/scanFiles.ts";

test("scanFiles 不允许扫描 core（core 内置模块必须静态导入注册）", async () => {
    let thrown: any = null;
    try {
        await scanFiles(".", "core" as any, "hook", "*.js");
    } catch (error: any) {
        thrown = error;
    }

    expect(thrown).toBeTruthy();
    expect(String(thrown?.message || "").includes("不允许扫描 core")).toBe(true);
});
