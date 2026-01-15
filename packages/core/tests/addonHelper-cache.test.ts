import { test, expect } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

import { join } from "pathe";

test("scanAddons - should scan node_modules @befly-addon", async () => {
    const originalCwd = process.cwd();
    const projectDir = join(originalCwd, "temp", `addonHelper-cache-test-${Date.now()}`);

    try {
        // 构造一个最小可扫描的项目结构
        mkdirSync(join(projectDir, "node_modules", "@befly-addon", "demo"), { recursive: true });
        mkdirSync(join(projectDir, "node_modules", "@befly-addon", "_ignore"), { recursive: true });

        // 放一个非目录项，确保扫描逻辑不会误判
        writeFileSync(join(projectDir, "node_modules", "@befly-addon", "README.md"), "x", { encoding: "utf8" });

        // scanAddons 依赖 appDir=process.cwd()（模块初始化时取值），所以先切 cwd 再动态 import
        process.chdir(projectDir);

        const mod = await import(`../utils/scanAddons.js?cacheTest=${Date.now()}`);
        const scanAddons = mod.scanAddons as () => any[];

        const addons = scanAddons();
        expect(addons.map((a) => a.name)).toEqual(["demo"]);
        expect(addons[0].rootDir.endsWith("node_modules/@befly-addon/demo")).toBe(true);
        expect(addons[0].camelName).toBe("demo");
    } finally {
        process.chdir(originalCwd);
        rmSync(projectDir, { recursive: true, force: true });
    }
});
