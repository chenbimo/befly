// 内部依赖（Node.js 内置模块）
import { existsSync, readFileSync, statSync } from "node:fs";
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

function main(): void {
    const packageRoot = process.cwd();

    const pkgPath = resolve(packageRoot, "package.json");
    if (!existsSync(pkgPath)) {
        process.stderr.write("[ensureDist] package.json not found\n");
        process.exit(1);
    }

    const pkg = JSON.parse(readFileSync(pkgPath, { encoding: "utf8" })) as PackageJson;

    const distDir = resolve(packageRoot, "dist");
    if (!existsSync(distDir)) {
        process.stderr.write("[ensureDist] dist/ not found (did you run build?)\n");
        process.exit(1);
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
