import { existsSync } from "node:fs";

import { relative, normalize, parse, join } from "pathe";

export interface ScanFileResult {
    filePath: string; // 绝对路径
    relativePath: string; // 相对路径（无扩展名）
    fileName: string; // 文件名（无扩展名）
}

/**
 * 扫描指定目录下的文件
 * @param dir 目录路径
 * @param pattern Glob 模式
 */
export async function scanFiles(dir: string, pattern: string = "**/*.ts"): Promise<ScanFileResult[]> {
    if (!existsSync(dir)) return [];

    const normalizedDir = normalize(dir);
    const glob = new Bun.Glob(pattern);
    const results: ScanFileResult[] = [];

    for await (const file of glob.scan({ cwd: dir, onlyFiles: true, absolute: true })) {
        if (file.endsWith(".d.ts")) continue;

        // 使用 pathe.normalize 统一路径分隔符为 /
        const normalizedFile = normalize(file);

        // 获取文件名（去除扩展名）
        const fileName = parse(normalizedFile).name;

        // 计算相对路径（去除扩展名）
        const relativePathWithExt = relative(normalizedDir, normalizedFile);
        const parsedRelativePath = parse(relativePathWithExt);
        const relativePath = parsedRelativePath.dir ? join(parsedRelativePath.dir, parsedRelativePath.name) : parsedRelativePath.name;

        // 固定默认过滤（不可关闭）：忽略下划线开头的文件/目录
        if (fileName.startsWith("_")) continue;
        if (relativePath.split("/").some((part) => part.startsWith("_"))) continue;

        results.push({
            filePath: normalizedFile,
            relativePath: relativePath,
            fileName: fileName
        });
    }
    return results;
}
