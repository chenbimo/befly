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
        expect(addons[0].fullPath.endsWith("node_modules/@befly-addon/demo")).toBe(true);
        expect(addons[0].camelName).toBe("demo");
    } finally {
        process.chdir(originalCwd);
        rmSync(projectDir, { recursive: true, force: true });
    }
});

test("scanAddons - local addons should override node_modules (subprocess + windows path)", async () => {
    const originalCwd = process.cwd();
    const projectDir = join(originalCwd, "temp", `addonHelper-override-test-${Date.now()}`);

    try {
        // node_modules addons
        mkdirSync(join(projectDir, "node_modules", "@befly-addon", "demo"), { recursive: true });
        mkdirSync(join(projectDir, "node_modules", "@befly-addon", "remote"), { recursive: true });
        mkdirSync(join(projectDir, "node_modules", "@befly-addon", "_ignore"), { recursive: true });
        writeFileSync(join(projectDir, "node_modules", "@befly-addon", "README.md"), "x", { encoding: "utf8" });

        // local addons (override demo)
        mkdirSync(join(projectDir, "addons", "demo"), { recursive: true });

        const scanAddonsUrl = new URL("../utils/scanAddons.ts", import.meta.url).href;
        const code = `
process.chdir(${JSON.stringify(projectDir)});
const mod = await import(${JSON.stringify(scanAddonsUrl + `?overrideTest=${Date.now()}`)});
const addons = mod.scanAddons();
process.stdout.write(JSON.stringify(addons.map((a) => ({
  name: a.name,
  source: a.source,
  sourceName: a.sourceName,
  rootDir: a.rootDir,
  fullPath: a.fullPath,
  camelName: a.camelName,
}))));
`;

        const proc = Bun.spawnSync({
            cmd: ["bun", "-e", code],
            cwd: originalCwd,
            stdout: "pipe",
            stderr: "pipe"
        });

        expect(proc.exitCode).toBe(0);

        const parsed = JSON.parse(proc.stdout.toString()) as any[];
        const names = parsed
            .map((a) => a.name)
            .slice()
            .sort();
        expect(names).toEqual(["demo", "remote"]);

        const demo = parsed.find((a) => a.name === "demo");
        expect(demo).toBeTruthy();
        expect(demo.source).toBe("app");
        expect(demo.sourceName).toBe("项目");
        expect(demo.camelName).toBe("demo");
        expect(String(demo.rootDir).replace(/\\/g, "/")).toContain("/addons/demo");
        expect(String(demo.rootDir)).toMatch(/^[A-Za-z]:[\\/]/);

        const remote = parsed.find((a) => a.name === "remote");
        expect(remote).toBeTruthy();
        expect(remote.source).toBe("addon");
        expect(remote.sourceName).toBe("组件");
        expect(String(remote.rootDir).replace(/\\/g, "/")).toContain("/node_modules/@befly-addon/remote");
        expect(String(remote.rootDir)).toMatch(/^[A-Za-z]:[\\/]/);
    } finally {
        rmSync(projectDir, { recursive: true, force: true });
    }
});
