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

function collectDtsFiles(dirPath: string): string[] {
    if (!existsSync(dirPath)) {
        return [];
    }

    const files = readdirSync(dirPath);
    return files.filter((file) => file.endsWith(".d.ts")).map((file) => resolve(dirPath, file));
}

function main(): void {
    const packageRoot = process.cwd();

    const pkgPath = resolve(packageRoot, "package.json");
    if (!existsSync(pkgPath)) {
        process.stderr.write("[ensureDist] package.json not found\n");
        process.exit(1);
    }

    const pkg = JSON.parse(readFileSync(pkgPath, { encoding: "utf8" })) as PackageJson;

    // 额外一致性校验：默认入口必须走 dist 产物（JS + DTS 分离）。
    if (typeof pkg.main !== "string" || !pkg.main.startsWith("./dist/")) {
        process.stderr.write("[ensureDist] package.json main must be a string under ./dist/\n");
        process.exit(1);
    }

    if (typeof pkg.types !== "string" || !pkg.types.startsWith("./dist/")) {
        process.stderr.write("[ensureDist] package.json types must be a string under ./dist/\n");
        process.exit(1);
    }

    if (pkg.main.endsWith(".ts") || pkg.types.endsWith(".ts")) {
        process.stderr.write("[ensureDist] package.json main/types must not point to .ts source files\n");
        process.exit(1);
    }

    if (!isRecord(pkg.exports) || !isRecord(pkg.exports["."])) {
        process.stderr.write("[ensureDist] package.json exports['.'] must be an object with { types, default }\n");
        process.exit(1);
    }

    const dotExport = pkg.exports["."] as Record<string, unknown>;
    const dotTypes = dotExport["types"];
    const dotDefault = dotExport["default"];

    if (dotTypes !== pkg.types) {
        process.stderr.write("[ensureDist] exports['.'].types must equal package.json types\n");
        process.exit(1);
    }

    if (dotDefault !== pkg.main) {
        process.stderr.write("[ensureDist] exports['.'].default must equal package.json main\n");
        process.exit(1);
    }

    if (typeof dotTypes === "string" && dotTypes.endsWith(".ts")) {
        process.stderr.write("[ensureDist] exports['.'].types must not point to .ts source files\n");
        process.exit(1);
    }

    if (typeof dotDefault === "string" && dotDefault.endsWith(".ts")) {
        process.stderr.write("[ensureDist] exports['.'].default must not point to .ts source files\n");
        process.exit(1);
    }

    const distDir = resolve(packageRoot, "dist");
    if (!existsSync(distDir)) {
        process.stderr.write("[ensureDist] dist/ not found (did you run build?)\n");
        process.exit(1);
    }

    // dist-only 发布规范：对外 types 相关声明不得引用源码 .ts。
    // - pkg.types (通常为 ./dist/index.d.ts)
    // - dist/types/*.d.ts（public types）
    {
        const offenders: Array<{ filePath: string; matches: string[] }> = [];

        if (typeof pkg.types === "string" && pkg.types.startsWith("./")) {
            const absPath = resolve(packageRoot, pkg.types);
            if (existsSync(absPath)) {
                const content = readFileSync(absPath, { encoding: "utf8" });
                const matches = findTsImportSpecifiers(content);
                if (matches.length > 0) {
                    offenders.push({ filePath: absPath, matches: matches });
                }
            }
        }

        const distTypesDir = resolve(packageRoot, "dist", "types");
        const typeDtsPaths = collectDtsFiles(distTypesDir);
        for (const absPath of typeDtsPaths) {
            const content = readFileSync(absPath, { encoding: "utf8" });
            const matches = findTsImportSpecifiers(content);
            if (matches.length > 0) {
                offenders.push({ filePath: absPath, matches: matches });
            }
        }

        if (offenders.length > 0) {
            process.stderr.write("[ensureDist] exported declaration files must not reference .ts source files\n");
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
