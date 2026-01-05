// 内部依赖（Node.js 内置模块）
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
    main?: string;
    types?: string;
    exports?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function collectExportPaths(exportsValue: unknown, out: string[]): void {
    if (typeof exportsValue === "string") {
        out.push(exportsValue);
        return;
    }

    if (Array.isArray(exportsValue)) {
        for (const item of exportsValue) {
            collectExportPaths(item, out);
        }
        return;
    }

    if (!isRecord(exportsValue)) {
        return;
    }

    for (const value of Object.values(exportsValue)) {
        collectExportPaths(value, out);
    }
}

function assertExportPathInDist(pathValue: string): void {
    if (!pathValue.startsWith("./")) {
        return;
    }

    if (!pathValue.startsWith("./dist/")) {
        process.stderr.write(`[ensureDist] export path must be under ./dist/: ${pathValue}\n`);
        process.exit(1);
    }

    if (pathValue.endsWith(".ts")) {
        process.stderr.write(`[ensureDist] export path must not point to .ts source files: ${pathValue}\n`);
        process.exit(1);
    }
}

function validateExportsShapeAndPaths(exportsValue: unknown): void {
    if (!isRecord(exportsValue)) {
        return;
    }

    for (const [key, value] of Object.entries(exportsValue)) {
        if (typeof value === "string") {
            assertExportPathInDist(value);
            continue;
        }

        if (!isRecord(value)) {
            continue;
        }

        const typesPath = value["types"];
        const defaultPath = value["default"];

        if (typeof typesPath === "string") {
            assertExportPathInDist(typesPath);
            if (!typesPath.includes("*") && !typesPath.endsWith(".d.ts")) {
                process.stderr.write(`[ensureDist] export '${key}'.types should end with .d.ts: ${typesPath}\n`);
                process.exit(1);
            }
        }

        if (typeof defaultPath === "string") {
            assertExportPathInDist(defaultPath);
            if (!defaultPath.includes("*") && !defaultPath.endsWith(".js")) {
                process.stderr.write(`[ensureDist] export '${key}'.default should end with .js: ${defaultPath}\n`);
                process.exit(1);
            }
        }
    }
}

function assertPathExists(packageRoot: string, relativeOrBare: string): void {
    if (!relativeOrBare.startsWith("./")) {
        return;
    }

    if (relativeOrBare.includes("*")) {
        const beforeStar = relativeOrBare.split("*")[0] ?? "";
        const dirPath = resolve(packageRoot, beforeStar);
        if (!existsSync(dirPath)) {
            process.stderr.write(`[ensureDist] missing export directory: ${beforeStar}\n`);
            process.exit(1);
        }

        const stat = statSync(dirPath);
        if (!stat.isDirectory()) {
            process.stderr.write(`[ensureDist] export directory is not a directory: ${beforeStar}\n`);
            process.exit(1);
        }

        return;
    }

    const absPath = resolve(packageRoot, relativeOrBare);
    if (!existsSync(absPath)) {
        process.stderr.write(`[ensureDist] missing export file: ${relativeOrBare}\n`);
        process.exit(1);
    }

    const stat = statSync(absPath);
    if (!stat.isFile()) {
        process.stderr.write(`[ensureDist] export path is not a file: ${relativeOrBare}\n`);
        process.exit(1);
    }
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

function collectDtsFilesRecursive(dirPath: string, out: string[]): void {
    if (!existsSync(dirPath)) {
        return;
    }

    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const absPath = resolve(dirPath, entry.name);
        if (entry.isDirectory()) {
            collectDtsFilesRecursive(absPath, out);
            continue;
        }

        if (entry.isFile() && entry.name.endsWith(".d.ts")) {
            out.push(absPath);
        }
    }
}

function main(): void {
    const packageRoot = process.cwd();

    const pkgPath = resolve(packageRoot, "package.json");
    if (!existsSync(pkgPath)) {
        process.stderr.write("[ensureDist] package.json not found\n");
        process.exit(1);
    }

    const pkg = JSON.parse(readFileSync(pkgPath, { encoding: "utf8" })) as PackageJson;

    // dist-only 发布规范：exports/main/types 均不得指向源码 .ts，且必须在 dist 下。
    if (typeof pkg.main === "string") {
        assertExportPathInDist(pkg.main);
    }
    if (typeof pkg.types === "string") {
        assertExportPathInDist(pkg.types);
    }
    validateExportsShapeAndPaths(pkg.exports);

    const distDir = resolve(packageRoot, "dist");
    if (!existsSync(distDir)) {
        process.stderr.write("[ensureDist] dist/ not found (did you run build?)\n");
        process.exit(1);
    }

    // dist-only 发布规范：任何 dist/**/*.d.ts 都不允许引用源码 .ts（防止消费者类型解析回退到源码）。
    {
        const dtsPaths: string[] = [];
        collectDtsFilesRecursive(distDir, dtsPaths);

        const offenders: Array<{ filePath: string; matches: string[] }> = [];
        for (const absPath of dtsPaths) {
            const content = readFileSync(absPath, { encoding: "utf8" });
            const matches = findTsImportSpecifiers(content);
            if (matches.length > 0) {
                offenders.push({ filePath: absPath, matches: matches });
            }
        }

        if (offenders.length > 0) {
            process.stderr.write("[ensureDist] dist/**/*.d.ts must not reference .ts source files\n");
            process.stderr.write(`${JSON.stringify(offenders, null, 4)}\n`);
            process.exit(1);
        }
    }

    const paths: string[] = [];

    if (typeof pkg.main === "string") {
        paths.push(pkg.main);
    }

    if (typeof pkg.types === "string") {
        paths.push(pkg.types);
    }

    collectExportPaths(pkg.exports, paths);

    for (const p of paths) {
        assertPathExists(packageRoot, p);
    }

    process.stdout.write("[ensureDist] OK\n");
}

main();
