import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function getSharedRootDir(): string {
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

function collectDtsFiles(dirPath: string): string[] {
    if (!existsSync(dirPath)) {
        return [];
    }

    const files = readdirSync(dirPath);
    return files.filter((file) => file.endsWith(".d.ts")).map((file) => join(dirPath, file));
}

describe("befly-shared - dist declarations should not reference .ts", () => {
    test("dist/utils/*.d.ts and dist/types/*.d.ts should not contain import specifiers ending with .ts", () => {
        const sharedRootDir = getSharedRootDir();
        const distDir = join(sharedRootDir, "dist");
        const distUtilsDir = join(distDir, "utils");
        const distTypesDir = join(distDir, "types");

        expect(existsSync(distDir)).toBe(true);

        const dtsPaths = [...collectDtsFiles(distUtilsDir), ...collectDtsFiles(distTypesDir)];
        expect(dtsPaths.length).toBeGreaterThan(0);

        const offenders: Array<{ filePath: string; matches: string[] }> = [];

        for (const absPath of dtsPaths) {
            const content = readFileSync(absPath, "utf8");
            const matches = findTsImportSpecifiers(content);
            if (matches.length > 0) {
                offenders.push({ filePath: absPath, matches: matches });
            }
        }

        if (offenders.length > 0) {
            throw new Error(`dist declarations must not reference .ts source files. Offenders:\n${JSON.stringify(offenders, null, 4)}`);
        }
    });
});
