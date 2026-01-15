import { expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

test("befly - default entry should only export Befly", async () => {
    const pkgRoot = resolve(import.meta.dir, "..");
    const distDir = resolve(pkgRoot, "dist");
    const distIndexPath = resolve(distDir, "index.js");

    // 约束：发布默认入口必须指向 dist/index.js（dist-only）。
    const pkgJsonPath = resolve(pkgRoot, "package.json");
    const pkgJsonText = readFileSync(pkgJsonPath, "utf8");
    const pkgJson = JSON.parse(pkgJsonText) as any;
    expect(pkgJson.exports).toBeDefined();
    expect(pkgJson.exports["."]).toBeDefined();
    expect(pkgJson.exports["."].import).toBe("./dist/index.js");
    expect(pkgJson.exports["."].default).toBe("./dist/index.js");

    // 这条测试验证的是“发布默认入口 import { Befly } from 'befly'”的行为。
    // 为了让仓库在 clean 状态/或 dist 被污染（例如遗留调试内容）时仍可自洽，
    // 这里会在必要时用 tsgo 重新生成 dist（最小化：只保证 dist/index.js 正确）。
    const shouldRebuildDist = () => {
        if (!existsSync(distIndexPath)) {
            return true;
        }
        const content = readFileSync(distIndexPath, "utf8");
        // 既接受“直接 export class Befly”，也接受“re-export Befly”。
        if (content.includes("export class Befly")) {
            return false;
        }
        if (content.includes("export { Befly")) {
            return false;
        }
        return true;
    };

    if (shouldRebuildDist()) {
        if (!existsSync(distDir)) {
            mkdirSync(distDir, { recursive: true });
        }

        const proc = Bun.spawn({
            cmd: ["bunx", "tsgo", "-p", "tsconfig.build.json"],
            cwd: pkgRoot,
            stdout: "ignore",
            stderr: "inherit"
        });
        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);
        expect(existsSync(distIndexPath)).toBe(true);
    }

    const distIndexContent = readFileSync(distIndexPath, "utf8");

    // 约束：默认入口仅导出 Befly（不允许 default export，也不允许导出其他符号）。
    expect(distIndexContent.includes("export default")).toBe(false);

    const exportClassMatches = Array.from(distIndexContent.matchAll(/export\s+class\s+([A-Za-z0-9_]+)/g));
    const exportFunctionMatches = Array.from(distIndexContent.matchAll(/export\s+function\s+([A-Za-z0-9_]+)/g));
    const exportConstMatches = Array.from(distIndexContent.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z0-9_]+)/g));

    for (const match of exportClassMatches) {
        expect(match[1]).toBe("Befly");
    }
    expect(exportFunctionMatches.length).toBe(0);
    expect(exportConstMatches.length).toBe(0);

    const exportListMatches = Array.from(distIndexContent.matchAll(/export\s*{\s*([^}]+)\s*}/g));
    if (exportListMatches.length === 0) {
        expect(exportClassMatches.length).toBeGreaterThan(0);
    } else {
        for (const match of exportListMatches) {
            const rawItems = String(match[1] || "")
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
            for (const item of rawItems) {
                const parts = item.split(/\s+as\s+/i).map((part) => part.trim());
                const name = parts[0] || "";
                const alias = parts[1] || "";
                expect(name).toBe("Befly");
                expect(alias).not.toBe("default");
            }
        }
    }
});
