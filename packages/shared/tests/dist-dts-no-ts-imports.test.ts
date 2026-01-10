import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function getSharedRootDir(): string {
    const testDir = dirname(fileURLToPath(import.meta.url));
    return join(testDir, "..");
}

type PackageJson = {
    types?: string;
    exports?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
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

function collectExportTypePaths(exportsValue: unknown, out: string[]): void {
    if (!isRecord(exportsValue)) {
        return;
    }

    for (const value of Object.values(exportsValue)) {
        if (typeof value === "string") {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                collectExportTypePaths(item, out);
            }
            continue;
        }

        if (!isRecord(value)) {
            continue;
        }

        const typesPath = value["types"];
        if (typeof typesPath === "string") {
            out.push(typesPath);
        }

        collectExportTypePaths(value, out);
    }
}

function expandDtsExportPath(packageRoot: string, exportPath: string): string[] {
    if (!exportPath.startsWith("./")) {
        return [];
    }

    if (!exportPath.includes("*")) {
        return [resolve(packageRoot, exportPath)];
    }

    const beforeStar = exportPath.split("*")[0] ?? "";
    const dirPath = resolve(packageRoot, beforeStar);
    if (!existsSync(dirPath)) {
        return [];
    }

    const stat = statSync(dirPath);
    if (!stat.isDirectory()) {
        return [];
    }

    const files = readdirSync(dirPath);
    return files.filter((file) => file.endsWith(".d.ts")).map((file) => resolve(dirPath, file));
}

function findDtsSpecifiers(content: string): string[] {
    const specifiers: string[] = [];

    const patterns: Array<RegExp> = [/from\s+["']([^"']+)["']/g, /import\(\s*["']([^"']+)["']\s*\)/g, /<reference\s+path=["']([^"']+)["']\s*\/>/g];

    for (const pattern of patterns) {
        for (const match of content.matchAll(pattern)) {
            const spec = match[1];
            if (typeof spec === "string" && spec.length > 0) {
                specifiers.push(spec);
            }
        }
    }

    return specifiers;
}

function resolveLocalDtsDependency(fromDtsPath: string, specifier: string): string | null {
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
        return null;
    }

    if (specifier.endsWith(".json")) {
        return null;
    }

    const baseDir = dirname(fromDtsPath);
    const absNoCheck = resolve(baseDir, specifier);

    const tryPaths: string[] = [];

    if (specifier.endsWith(".d.ts")) {
        tryPaths.push(absNoCheck);
    } else if (specifier.endsWith(".js") || specifier.endsWith(".mjs") || specifier.endsWith(".cjs")) {
        const replaced = absNoCheck.replace(/\.(mjs|cjs|js)$/u, ".d.ts");
        tryPaths.push(replaced);
        tryPaths.push(`${absNoCheck}.d.ts`);
    } else {
        tryPaths.push(`${absNoCheck}.d.ts`);
    }

    tryPaths.push(resolve(absNoCheck, "index.d.ts"));

    for (const p of tryPaths) {
        if (existsSync(p)) {
            return p;
        }
    }

    return null;
}

function collectReachableDtsFromEntrypoints(distDir: string, entrypoints: string[]): string[] {
    const visited = new Set<string>();
    const queue: string[] = [];

    for (const entry of entrypoints) {
        if (!entry.startsWith(distDir)) {
            continue;
        }
        if (existsSync(entry) && entry.endsWith(".d.ts")) {
            queue.push(entry);
        }
    }

    while (queue.length > 0) {
        const current = queue.pop();
        if (!current) {
            continue;
        }
        if (visited.has(current)) {
            continue;
        }
        visited.add(current);

        const content = readFileSync(current, "utf8");
        const specifiers = findDtsSpecifiers(content);
        for (const specifier of specifiers) {
            const resolved = resolveLocalDtsDependency(current, specifier);
            if (!resolved) {
                continue;
            }
            if (!resolved.startsWith(distDir)) {
                continue;
            }
            if (!visited.has(resolved)) {
                queue.push(resolved);
            }
        }
    }

    return Array.from(visited);
}

describe("befly-shared - dist declarations should not reference .ts", () => {
    test("dist/utils/*.d.ts and dist/types/*.d.ts should not contain import specifiers ending with .ts", () => {
        const sharedRootDir = getSharedRootDir();
        const distDir = resolve(sharedRootDir, "dist");

        expect(existsSync(distDir)).toBe(true);

        const pkgPath = resolve(sharedRootDir, "package.json");
        expect(existsSync(pkgPath)).toBe(true);
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as PackageJson;

        const entryPaths: string[] = [];
        if (typeof pkg.types === "string") {
            entryPaths.push(pkg.types);
        }
        collectExportTypePaths(pkg.exports, entryPaths);

        const entryDtsAbsPaths = new Set<string>();
        for (const exportPath of entryPaths) {
            for (const absPath of expandDtsExportPath(sharedRootDir, exportPath)) {
                entryDtsAbsPaths.add(absPath);
            }
        }

        expect(entryDtsAbsPaths.size).toBeGreaterThan(0);

        const dtsPaths = collectReachableDtsFromEntrypoints(distDir, Array.from(entryDtsAbsPaths));
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
