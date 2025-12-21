import { test, expect } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

import { join } from "pathe";

test("scanAddons - should reuse in-process cache for same cwd", async () => {
    const projectDir = join(process.cwd(), "temp", `addonHelper-cache-test-${Date.now()}`);

    try {
        // 构造一个最小可扫描的项目结构
        mkdirSync(join(projectDir, "addons", "demo"), { recursive: true });
        mkdirSync(join(projectDir, "node_modules", "@befly-addon", "demo"), { recursive: true });

        // 放一个非目录项，确保扫描逻辑不会误判
        writeFileSync(join(projectDir, "addons", "README.md"), "x", { encoding: "utf8" });

        const mod = await import(`../utils/scanAddons.js?cacheTest=${Date.now()}`);
        const scanAddons = mod.scanAddons as (cwd?: string) => any[];

        const first = scanAddons(projectDir);
        expect(first.length).toBe(2);

        // 删除目录：如果第二次调用仍返回相同结果，说明命中进程内缓存（而不是重新扫磁盘）。
        rmSync(join(projectDir, "addons"), { recursive: true, force: true });
        rmSync(join(projectDir, "node_modules"), { recursive: true, force: true });

        // 用不同的 cwd 字符串形式触发 key 规范化逻辑（Windows 下大小写不敏感）
        const second = scanAddons(projectDir.toUpperCase());
        expect(second).toEqual(first);
    } finally {
        rmSync(projectDir, { recursive: true, force: true });
    }
});
