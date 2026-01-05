import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function getCoreRootDir(): string {
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

function collectExportTypePaths(exportsValue: unknown, out: string[]): void {
    if (!isRecord(exportsValue)) {
        return;
    }

    // 常见结构：
    // {
    //   ".": { default, types },
    //   "./types/*": { default, types },
    //   ...
    // }
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

    // 忽略显式 json 等非声明依赖。
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

    // 目录导入：./x -> ./x/index.d.ts
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

function findTsImportSpecifiersInDts(content: string): string[] {
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
        const distDir = resolve(coreRootDir, "dist");

        expect(existsSync(distDir)).toBe(true);

        const pkgPath = resolve(coreRootDir, "package.json");
        expect(existsSync(pkgPath)).toBe(true);
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as PackageJson;

        const entryPaths: string[] = [];
        if (typeof pkg.types === "string") {
            entryPaths.push(pkg.types);
        }
        collectExportTypePaths(pkg.exports, entryPaths);

        const entryDtsAbsPaths = new Set<string>();
        for (const exportPath of entryPaths) {
            for (const absPath of expandDtsExportPath(coreRootDir, exportPath)) {
                entryDtsAbsPaths.add(absPath);
            }
        }

        // 至少要有一个可达的入口声明。
        expect(entryDtsAbsPaths.size).toBeGreaterThan(0);

        const reachableDtsPaths = collectReachableDtsFromEntrypoints(distDir, Array.from(entryDtsAbsPaths));
        expect(reachableDtsPaths.length).toBeGreaterThan(0);

        const offenders: Array<{ filePath: string; matches: string[] }> = [];

        for (const absPath of reachableDtsPaths) {
            const content = readFileSync(absPath, "utf8");
            const matches = findTsImportSpecifiersInDts(content);
            if (matches.length > 0) {
                offenders.push({ filePath: absPath, matches: matches });
            }
        }

        if (offenders.length > 0) {
            throw new Error(`dist/types declarations must not reference .ts source files. Offenders:\n${JSON.stringify(offenders, null, 4)}`);
        }
    });
});
