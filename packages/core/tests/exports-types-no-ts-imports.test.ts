import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function getCoreRootDir(): string {
    const testDir = dirname(fileURLToPath(import.meta.url));
    return join(testDir, "..");
}

function findTsImportSpecifiers(content: string): string[] {
    const matches: string[] = [];

    const patterns = [/from\s+["'][^"']+\.ts["']/g, /import\(\s*["'][^"']+\.ts["']\s*\)/g, /<reference\s+path=["'][^"']+\.ts["']\s*\/>/g];

    for (const pattern of patterns) {
        const found = content.match(pattern);
        if (found && found.length > 0) {
            matches.push(...found);
        }
    }

    return matches;
}

describe("befly - dist/types declarations should not reference .ts", () => {
    test("dist/types/*.d.ts should not contain import specifiers ending with .ts", () => {
        const coreRootDir = getCoreRootDir();
        const distIndexDtsPath = join(coreRootDir, "dist", "index.d.ts");
        const distTypesDir = join(coreRootDir, "dist", "types");

        expect(existsSync(distTypesDir)).toBe(true);

        const offenders: Array<{ filePath: string; matches: string[] }> = [];

        // 默认入口的声明也必须保持 dist-only（不引用 .ts 源码）。
        expect(existsSync(distIndexDtsPath)).toBe(true);
        {
            const content = readFileSync(distIndexDtsPath, "utf8");
            const matches = findTsImportSpecifiers(content);
            if (matches.length > 0) {
                offenders.push({ filePath: distIndexDtsPath, matches: matches });
            }
        }

        const files = readdirSync(distTypesDir);
        const dtsFiles = files.filter((file) => file.endsWith(".d.ts"));
        expect(dtsFiles.length).toBeGreaterThan(0);

        for (const dtsFile of dtsFiles) {
            const absPath = join(distTypesDir, dtsFile);
            const content = readFileSync(absPath, "utf8");
            const matches = findTsImportSpecifiers(content);
            if (matches.length > 0) {
                offenders.push({ filePath: absPath, matches: matches });
            }
        }

        if (offenders.length > 0) {
            throw new Error(`dist/types declarations must not reference .ts source files. Offenders:\n${JSON.stringify(offenders, null, 4)}`);
        }
    });
});
