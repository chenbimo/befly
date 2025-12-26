import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type JsonObject = Record<string, unknown>;

const repoRoot = "d:\\codes\\befly";

const SKIP_DIR_NAMES = new Set([
    ".git",
    ".bun",
    "node_modules",
    // 临时目录不参与（避免处理脚本自身或用户临时文件）
    "temp"
]);

const FILES_EXCLUDE_NAMES = new Set(["node_modules", "tests", "dist", "logs", "note.md"]);

function naturalCompare(a: string, b: string): number {
    return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

function buildFilesFieldFromPackageDir(absPackageDir: string): string[] {
    const entries = readdirSync(absPackageDir, { withFileTypes: true });

    const dirNames: string[] = [];
    const fileNames: string[] = [];

    for (const ent of entries) {
        const name = ent.name;

        if (FILES_EXCLUDE_NAMES.has(name)) {
            continue;
        }

        // 安全：忽略生成物/依赖目录
        if (ent.isDirectory()) {
            // 目录项只需要一级，且必须以 / 结尾
            dirNames.push(`${name}/`);
            continue;
        }

        if (ent.isFile()) {
            fileNames.push(name);
            continue;
        }

        // symlink / 其他类型：按文件处理（保持可见性）
        fileNames.push(name);
    }

    dirNames.sort(naturalCompare);
    fileNames.sort(naturalCompare);

    return [...dirNames, ...fileNames];
}

function findPackageJsonFiles(absDir: string, out: string[]): void {
    const entries = readdirSync(absDir, { withFileTypes: true });

    for (const ent of entries) {
        const abs = join(absDir, ent.name);

        if (ent.isDirectory()) {
            if (SKIP_DIR_NAMES.has(ent.name)) {
                continue;
            }

            findPackageJsonFiles(abs, out);
            continue;
        }

        if (!ent.isFile()) {
            continue;
        }

        if (ent.name !== "package.json") {
            continue;
        }

        out.push(abs);
    }
}

function main(): void {
    const packageJsonPaths: string[] = [];
    findPackageJsonFiles(repoRoot, packageJsonPaths);

    // root package.json 也会被扫到；本脚本只处理要发布的 package（private !== true）
    let changedCount = 0;

    for (const filePath of packageJsonPaths) {
        const raw = readFileSync(filePath, { encoding: "utf8" });

        let json: JsonObject;
        try {
            json = JSON.parse(raw) as JsonObject;
        } catch {
            process.stderr.write(`[normalize-files] skip invalid json: ${filePath}\n`);
            continue;
        }

        const isPrivate = json.private === true;
        if (isPrivate) {
            continue;
        }

        const absBaseDir = dirname(filePath);
        const desired = buildFilesFieldFromPackageDir(absBaseDir);

        const current = json.files;
        const currentArray = Array.isArray(current) ? (current as string[]) : null;
        const same = currentArray !== null && desired.length === currentArray.length && desired.every((v, i) => v === currentArray[i]);

        if (same) {
            continue;
        }

        json.files = desired;

        writeFileSync(filePath, `${JSON.stringify(json, null, 4)}\n`, { encoding: "utf8" });
        changedCount += 1;
        process.stdout.write(`[normalize-files] updated: ${filePath}\n`);
    }

    process.stdout.write(`[normalize-files] done. updated ${changedCount} package.json file(s).\n`);
}

main();
