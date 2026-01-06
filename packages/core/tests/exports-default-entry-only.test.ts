import { expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

test("befly - default entry should only export Befly", async () => {
    const pkgRoot = resolve(import.meta.dir, "..");
    const distDir = resolve(pkgRoot, "dist");
    const distIndexPath = resolve(distDir, "index.js");

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

    // 避免同进程 import 缓存影响（尤其是 dist 发生重建时），用子进程验证解析与导出。
    const verifyProc = Bun.spawn({
        cmd: ["bun", "-e", ["import('befly').then((m) => {", "  const keys = Object.keys(m).sort();", "  if (keys.length !== 1 || keys[0] !== 'Befly') process.exit(1);", "  if (typeof m.Befly !== 'function') process.exit(1);", "}).catch(() => process.exit(1));"].join("\n")],
        cwd: pkgRoot,
        stdout: "ignore",
        stderr: "inherit"
    });
    const verifyExitCode = await verifyProc.exited;
    expect(verifyExitCode).toBe(0);
});
