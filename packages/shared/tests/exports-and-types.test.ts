import type { ArrayToTree } from "befly-shared/types/arrayToTree";

import { describe, expect, test } from "bun:test";

describe("befly-shared - exports/types sanity", () => {
    test("package.json should include types/ and export ./types/*", async () => {
        const pkgUrl = new URL("../package.json", import.meta.url);
        const pkg = (await Bun.file(pkgUrl).json()) as any;

        expect(typeof pkg.name).toBe("string");
        expect(pkg.name).toBe("befly-shared");

        expect(Array.isArray(pkg.files)).toBe(true);
        expect(pkg.files.includes("types/")).toBe(true);
        expect(pkg.files.includes("utils/")).toBe(true);

        expect(pkg.exports && typeof pkg.exports === "object").toBe(true);
        expect(pkg.exports["./utils/*"]).toBe("./utils/*.ts");
        expect(pkg.exports["./types/*"]).toBe("./types/*.ts");

        // 防止误加 "./*": "./index.js" 之类的导出（项目规范禁止）
        expect(Object.prototype.hasOwnProperty.call(pkg.exports, "./*")).toBe(false);
    });

    test("should be able to resolve subpath imports at runtime", async () => {
        // utils 子路径：应可解析
        const utilsMod = await import("befly-shared/utils/withDefaultColumns");
        expect(typeof utilsMod.withDefaultColumns).toBe("function");

        // types 子路径：应可解析（运行时通常为空模块，但解析必须成功）
        const typesMod = (await import("befly-shared/types/arrayToTree")) as any;
        expect(typesMod && typeof typesMod === "object").toBe(true);

        // 这里用一个纯类型引用，确保 TS 侧能解析到该类型声明（即便运行时被擦除）
        const _typeOnly: ArrayToTree | null = null;
        expect(_typeOnly).toBeNull();
    });
});
