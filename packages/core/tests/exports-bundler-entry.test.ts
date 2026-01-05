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
    expect(pkgJson.exports["./all"].types).toBe("./dist/index.d.ts");
    expect(pkgJson.exports["./all"].import).toBe("./dist/index.all.js");
    expect(pkgJson.exports["./all"].default).toBe("./dist/index.all.js");

    const distDir = resolve(pkgRoot, "dist");
    const distAllEntryPath = resolve(distDir, "index.all.js");

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
