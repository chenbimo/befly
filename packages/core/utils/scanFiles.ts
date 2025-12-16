import { existsSync } from 'node:fs';

import { relative, basename, normalize } from 'pathe';

export interface ScanFileResult {
    filePath: string; // 绝对路径
    relativePath: string; // 相对路径（无扩展名）
    fileName: string; // 文件名（无扩展名）
}

/**
 * 扫描指定目录下的文件
 * @param dir 目录路径
 * @param pattern Glob 模式
 * @param ignoreUnderline 是否忽略下划线开头的文件/目录
 */
export async function scanFiles(dir: string, pattern: string = '**/*.{ts,js}', ignoreUnderline: boolean = true): Promise<ScanFileResult[]> {
    if (!existsSync(dir)) return [];

    const normalizedDir = normalize(dir);
    const glob = new Bun.Glob(pattern);
    const results: ScanFileResult[] = [];

    for await (const file of glob.scan({ cwd: dir, onlyFiles: true, absolute: true })) {
        if (file.endsWith('.d.ts')) continue;

        // 使用 pathe.normalize 统一路径分隔符为 /
        const normalizedFile = normalize(file);

        // 获取文件名（去除扩展名）
        const fileName = basename(normalizedFile).replace(/\.[^.]+$/, '');

        // 计算相对路径（pathe.relative 返回的已经是正斜杠路径）
        const relativePath = relative(normalizedDir, normalizedFile).replace(/\.[^/.]+$/, '');

        if (ignoreUnderline) {
            // 检查文件名是否以下划线开头
            if (fileName.startsWith('_')) continue;
            // 检查路径中是否包含下划线开头的目录
            if (relativePath.split('/').some((part) => part.startsWith('_'))) continue;
        }

        results.push({
            filePath: normalizedFile,
            relativePath: relativePath,
            fileName: fileName
        });
    }
    return results;
}
