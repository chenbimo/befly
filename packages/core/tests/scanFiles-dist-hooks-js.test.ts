import { test, expect } from "bun:test";
import { existsSync } from "node:fs";

import { join } from "pathe";

import { coreDir } from "../paths.ts";
import { scanFiles } from "../utils/scanFiles.ts";

const distHooksDir = join(coreDir, "dist", "hooks");

if (!existsSync(distHooksDir)) {
    test.skip("scanFiles 可扫描 dist/hooks/*.js（dist 不存在时跳过）", () => {
        expect(true).toBe(true);
    });
} else {
    test("scanFiles 可扫描 dist/hooks/*.js", async () => {
        const results = await scanFiles(distHooksDir, "core", "hook", "*.js");
        expect(results.length).toBeGreaterThan(0);
    });
}
