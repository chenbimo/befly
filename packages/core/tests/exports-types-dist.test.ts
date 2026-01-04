import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function getCoreRootDir(): string {
    const testDir = dirname(fileURLToPath(import.meta.url));
    return join(testDir, "..");
}

describe("befly - exports/types dist artifact", () => {
    test("package.json exports['./types/*'] should point to dist/types/*.d.ts and dist/types should contain .d.ts", () => {
        const coreRootDir = getCoreRootDir();
        const pkgJsonPath = join(coreRootDir, "package.json");
        const distTypesDir = join(coreRootDir, "dist", "types");
        const srcTypesDir = join(coreRootDir, "types");

        const pkgRaw = readFileSync(pkgJsonPath, "utf8");
        const pkg = JSON.parse(pkgRaw) as any;

        expect(pkg).toBeDefined();
        expect(pkg.exports).toBeDefined();

        const typesExport = pkg.exports["./types/*"] as any;
        expect(typesExport).toBeDefined();

        if (typeof typesExport === "string") {
            expect(typesExport).toBe("./dist/types/*.d.ts");
        } else {
            expect(typesExport.types).toBe("./dist/types/*.d.ts");
        }

        // 这条断言是为了防止未来构建流程变更后，dist/types 悄悄不再产出声明文件。
        expect(existsSync(distTypesDir)).toBe(true);

        const distFiles = readdirSync(distTypesDir);
        const distDtsFiles = distFiles.filter((file) => file.endsWith(".d.ts"));
        expect(distDtsFiles.length).toBeGreaterThan(0);

        // 动态断言：types 源文件存在什么模块，就必须在 dist/types 产出对应的 .d.ts。
        // 这样 future-proof：新增/删除 types 模块时无需手动维护 mustHave 清单。
        expect(existsSync(srcTypesDir)).toBe(true);

        const srcFiles = readdirSync(srcTypesDir);
        const srcTypeModules = srcFiles.filter((file) => file.endsWith(".ts")).map((file) => file.replace(/\.ts$/, ".d.ts"));

        for (const dtsFile of srcTypeModules) {
            expect(distDtsFiles.includes(dtsFile)).toBe(true);

            // “可被解析/存在”：至少能被读取且非空（避免产出空壳或路径错误）。
            const dtsPath = join(distTypesDir, dtsFile);
            const content = readFileSync(dtsPath, "utf8");
            expect(typeof content).toBe("string");
            expect(content.length).toBeGreaterThan(0);
        }
    });
});
