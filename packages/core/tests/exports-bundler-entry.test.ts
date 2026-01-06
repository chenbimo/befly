import { expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

test("befly - all entry should export Befly", async () => {
    const pkgRoot = resolve(import.meta.dir, "..");
    const pkgJsonPath = resolve(pkgRoot, "package.json");
    const pkgJsonText = readFileSync(pkgJsonPath, "utf8");
    const pkgJson = JSON.parse(pkgJsonText);

    expect(pkgJson.exports).toBeDefined();
    expect(pkgJson.exports["./all"]).toBeDefined();
    expect(pkgJson.exports["./all"].import).toBe("./dist/befly.js");
    expect(pkgJson.exports["./all"].default).toBe("./dist/befly.js");

    // 类型导出统一到：顶层 types + exports['./types/*']，不要把 types 分散挂到每个运行时入口上。
    expect(pkgJson.types).toBe("./dist/index.d.ts");
    expect(pkgJson.exports["./types/*"]).toBeDefined();
    expect(pkgJson.exports["./types/*"].types).toBe("./dist/types/*.d.ts");
    expect(pkgJson.exports["./all"].types).toBeUndefined();

    const distDir = resolve(pkgRoot, "dist");
    const distAllEntryPath = resolve(distDir, "befly.js");

    if (!existsSync(distAllEntryPath)) {
        if (!existsSync(distDir)) {
            mkdirSync(distDir, { recursive: true });
        }

        const proc = Bun.spawn({
            cmd: ["bun", "run", "bundle"],
            cwd: pkgRoot,
            stdout: "ignore",
            stderr: "inherit"
        });

        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);
        expect(existsSync(distAllEntryPath)).toBe(true);
    }

    const modUrl = `${pathToFileURL(distAllEntryPath).href}?t=${Date.now()}`;
    const mod = await import(modUrl);

    const keys = Object.keys(mod).sort();
    expect(keys).toEqual(["Befly"]);
    expect(typeof (mod as any).Befly).toBe("function");
});
