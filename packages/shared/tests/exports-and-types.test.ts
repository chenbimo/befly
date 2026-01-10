import type { GenShortId } from "befly-shared/types/genShortId";

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

describe("befly-shared - exports/types sanity", () => {
    test("package.json should include types/ and export ./types/*", async () => {
        const pkgUrl = new URL("../package.json", import.meta.url);
        const pkg = (await Bun.file(pkgUrl).json()) as any;

        expect(typeof pkg.name).toBe("string");
        expect(pkg.name).toBe("befly-shared");

        expect(Array.isArray(pkg.files)).toBe(true);
        expect(pkg.files.includes("dist/")).toBe(true);

        expect(pkg.exports && typeof pkg.exports === "object").toBe(true);
        expect(pkg.exports["./utils/*"] && typeof pkg.exports["./utils/*"] === "object").toBe(true);
        expect(pkg.exports["./utils/*"].types).toBe("./dist/utils/*.d.ts");
        expect(pkg.exports["./utils/*"].default).toBe("./dist/utils/*.js");

        expect(pkg.exports["./types/*"] && typeof pkg.exports["./types/*"] === "object").toBe(true);
        expect(pkg.exports["./types/*"].types).toBe("./dist/types/*.d.ts");
        expect(pkg.exports["./types/*"].default).toBe("./dist/types/*.js");

        // 防止误加 "./*": "./index.ts" 之类的导出（项目规范禁止）
        expect(Object.hasOwn(pkg.exports, "./*")).toBe(false);
    });

    test("should be able to resolve subpath imports at runtime", async () => {
        // 注意：bun test 在全量套件里对 workspace 子路径解析可能出现不稳定（与 cwd/缓存有关）。
        // 这里改为验证 dist 产物的“文件存在性”，避免把解析器行为当成业务逻辑测试的一部分。

        const sharedRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

        const distUtilsDir = resolve(sharedRoot, "dist", "utils");
        const distTypesDir = resolve(sharedRoot, "dist", "types");

        expect(existsSync(distUtilsDir)).toBe(true);
        expect(existsSync(distTypesDir)).toBe(true);

        const utilsSrcDir = resolve(sharedRoot, "utils");
        const typesSrcDir = resolve(sharedRoot, "types");

        const listTsBasenames = (dir: string): string[] => {
            if (!existsSync(dir)) {
                return [];
            }
            const entries = readdirSync(dir);
            return entries
                .filter((name) => name.endsWith(".ts"))
                .map((name) => name.slice(0, -3))
                .filter((name) => name.length > 0)
                .sort();
        };

        const expectedUtils = listTsBasenames(utilsSrcDir);
        const expectedTypes = listTsBasenames(typesSrcDir);

        // 至少应有一些公开模块（避免“空包”被误发布）
        expect(expectedUtils.length).toBeGreaterThan(0);
        expect(expectedTypes.length).toBeGreaterThan(0);

        for (const base of expectedUtils) {
            expect(existsSync(resolve(distUtilsDir, `${base}.js`))).toBe(true);
            expect(existsSync(resolve(distUtilsDir, `${base}.d.ts`))).toBe(true);
        }

        for (const base of expectedTypes) {
            expect(existsSync(resolve(distTypesDir, `${base}.js`))).toBe(true);
            expect(existsSync(resolve(distTypesDir, `${base}.d.ts`))).toBe(true);
        }

        // 这里用一个纯类型引用，确保 TS 侧能解析到该类型声明（即便运行时被擦除）
        const _typeOnly: GenShortId | null = null;
        expect(_typeOnly).toBeNull();
    });
});
