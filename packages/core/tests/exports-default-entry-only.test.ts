import { expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

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

    // 避免 Bun/Node 在 workspace 场景下对 "befly" 自引用解析出现不稳定：
    // - 我们只验证“默认入口实际指向的 dist/index.js”导出是否只有 Befly。
    // - 同时已通过 package.json exports['.'] 断言确保发布默认入口就是 dist/index.js。
    // 用子进程 + file URL 导入，规避同进程 import 缓存（尤其是 dist 刚重建时）。
    const distIndexUrl = pathToFileURL(distIndexPath).href;
    const verifyProc = Bun.spawn({
        cmd: [
            "bun",
            "-e",
            [
                "const base = process.env.BEFLY_ENTRY_URL;",
                "if (!base) process.exit(1);",
                "const url = base + '?t=' + Date.now();",
                "import(url)",
                "  .then((m) => {",
                "    const keys = Object.keys(m).sort();",
                "    if (keys.length !== 1 || keys[0] !== 'Befly') process.exit(1);",
                "    if (typeof m.Befly !== 'function') process.exit(1);",
                "  })",
                "  .catch(() => process.exit(1));"
            ].join("\n")
        ],
        cwd: pkgRoot,
        env: Object.assign({}, process.env, { BEFLY_ENTRY_URL: distIndexUrl }),
        stdout: "ignore",
        stderr: "inherit"
    });
    const verifyExitCode = await verifyProc.exited;
    expect(verifyExitCode).toBe(0);
});
