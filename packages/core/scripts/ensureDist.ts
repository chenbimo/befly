// 内部依赖（Node.js 内置模块）
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

type PackageJson = {
    main?: string;
    types?: string;
    exports?: unknown;
};

function isTsSourcePath(p: string): boolean {
    // 注意：.d.ts 是构建产物，必须允许；这里仅阻断指向源码的 .ts 入口。
    if (!p.endsWith(".ts")) {
        return false;
    }
    if (p.endsWith(".d.ts") || p.endsWith(".d.mts") || p.endsWith(".d.cts")) {
        return false;
    }
    return true;
}

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

        const content = readFileSync(current, { encoding: "utf8" });
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

    if (isTsSourcePath(pkg.main) || isTsSourcePath(pkg.types)) {
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

    if (typeof dotTypes === "string" && isTsSourcePath(dotTypes)) {
        process.stderr.write("[ensureDist] exports['.'].types must not point to .ts source files\n");
        process.exit(1);
    }

    if (typeof dotDefault === "string" && isTsSourcePath(dotDefault)) {
        process.stderr.write("[ensureDist] exports['.'].default must not point to .ts source files\n");
        process.exit(1);
    }

    const distDir = resolve(packageRoot, "dist");
    if (!existsSync(distDir)) {
        process.stderr.write("[ensureDist] dist/ not found (did you run build?)\n");
        process.exit(1);
    }

    // dist-only 发布规范：从对外可达入口（pkg.types + exports.*.types）出发的声明闭包中，
    // 任何 .d.ts 都不允许引用源码 .ts（防止消费者类型解析回退到源码）。
    {
        const exportTypePaths: string[] = [];
        if (typeof pkg.types === "string") {
            exportTypePaths.push(pkg.types);
        }
        collectExportTypePaths(pkg.exports, exportTypePaths);

        const entryDtsAbsPaths = new Set<string>();
        for (const exportPath of exportTypePaths) {
            for (const absPath of expandDtsExportPath(packageRoot, exportPath)) {
                entryDtsAbsPaths.add(absPath);
            }
        }

        if (entryDtsAbsPaths.size === 0) {
            process.stderr.write("[ensureDist] no exported .d.ts entrypoints found (types/exports.types)\n");
            process.exit(1);
        }

        const reachableDtsPaths = collectReachableDtsFromEntrypoints(distDir, Array.from(entryDtsAbsPaths));
        if (reachableDtsPaths.length === 0) {
            process.stderr.write("[ensureDist] no reachable .d.ts files found from exported entrypoints\n");
            process.exit(1);
        }

        const offenders: Array<{ filePath: string; matches: string[] }> = [];

        for (const absPath of reachableDtsPaths) {
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
