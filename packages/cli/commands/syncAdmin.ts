/**
 * Sync Admin 命令 - 同步前端 admin 模板
 * 下载 befly-admin 包并同步所有文件和目录
 * - 排除 node_modules
 * - internal 目录强制更新
 * - 其他文件/目录不存在时创建，存在则保持原样
 */

import { join, relative, normalize, sep, dirname } from 'pathe';
import { tmpdir } from 'node:os';
import { rm, readdir, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { Logger } from '../util.js';
import extract from 'fast-extract';

/**
 * 判断路径是否在 internal 目录内
 */
function isInternalPath(filePath: string, baseDir: string): boolean {
    const rel = normalize(relative(baseDir, filePath));
    const parts = rel.split(sep);
    return parts.includes('internal');
}

/**
 * 判断路径是否应该被排除
 */
function shouldExclude(filePath: string, baseDir: string): boolean {
    const rel = normalize(relative(baseDir, filePath));
    const parts = rel.split(sep);

    if (parts.includes('node_modules')) {
        return true;
    }

    return false;
}

/**
 * 递归复制目录（用于 internal 目录的完整复制）
 */
async function copyDirRecursive(source: string, target: string): Promise<{ copied: number }> {
    let copied = 0;
    const entries = await readdir(source, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = join(source, entry.name);
        const targetPath = join(target, entry.name);

        if (entry.isDirectory()) {
            await mkdir(targetPath, { recursive: true });
            const result = await copyDirRecursive(sourcePath, targetPath);
            copied += result.copied;
        } else {
            await copyFile(sourcePath, targetPath);
            copied++;
        }
    }

    return { copied: copied };
}

/**
 * 递归同步目录（单次遍历，条件判断）
 */
async function syncDirectory(sourceDir: string, targetDir: string, packageDir: string): Promise<{ created: number; updated: number; skipped: number }> {
    const stats = {
        created: 0,
        updated: 0,
        skipped: 0
    };

    const entries = await readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = join(sourceDir, entry.name);
        const targetPath = join(targetDir, entry.name);

        if (shouldExclude(sourcePath, packageDir)) {
            continue;
        }

        if (entry.isDirectory()) {
            const isInternal = isInternalPath(sourcePath, packageDir);

            if (isInternal) {
                if (existsSync(targetPath)) {
                    await rm(targetPath, { recursive: true, force: true });
                }
                await mkdir(targetPath, { recursive: true });

                const subStats = await copyDirRecursive(sourcePath, targetPath);
                stats.updated += subStats.copied;

                Logger.debug(`强制更新: ${relative(packageDir, sourcePath)}`);
            } else {
                if (!existsSync(targetPath)) {
                    await mkdir(targetPath, { recursive: true });
                    stats.created++;
                    Logger.debug(`创建目录: ${relative(packageDir, sourcePath)}`);
                }

                const subStats = await syncDirectory(sourcePath, targetPath, packageDir);
                stats.created += subStats.created;
                stats.updated += subStats.updated;
                stats.skipped += subStats.skipped;
            }
        } else {
            const isInInternal = isInternalPath(sourcePath, packageDir);

            if (!isInInternal) {
                if (!existsSync(targetPath)) {
                    const targetDirPath = dirname(targetPath);
                    if (!existsSync(targetDirPath)) {
                        await mkdir(targetDirPath, { recursive: true });
                    }
                    await copyFile(sourcePath, targetPath);
                    stats.created++;
                    Logger.debug(`创建文件: ${relative(packageDir, sourcePath)}`);
                } else {
                    stats.skipped++;
                }
            }
        }
    }

    return stats;
}

/**
 * Sync Admin 命令
 */
export async function syncAdminCommand() {
    const tempDir = join(tmpdir(), `befly-admin-${Date.now()}`);
    const tarballPath = join(tempDir, 'package.tgz');
    const extractDir = join(tempDir, 'extracted');

    try {
        await mkdir(tempDir, { recursive: true });

        // 1. 获取并下载最新版本
        Logger.info('正在获取 befly-admin 最新版本...');
        const metaData = await fetch('https://registry.npmmirror.com/befly-admin/latest').then((res) => res.json());

        Logger.info(`正在下载 befly-admin@${metaData.version}...`);
        await Bun.write(tarballPath, await fetch(metaData.dist.tarball).then((res) => res.arrayBuffer()));

        // 2. 解压
        Logger.info('正在解压...');
        await extract(tarballPath, extractDir, { strip: 0 });

        // 3. 同步所有文件和目录
        const packageDir = join(extractDir, 'package');
        if (!existsSync(packageDir)) {
            throw new Error('下载的包结构异常');
        }

        Logger.info('正在同步文件...');
        const targetDir = process.cwd();

        const stats = await syncDirectory(packageDir, targetDir, packageDir);

        // 4. 清理临时目录
        await rm(tempDir, { recursive: true, force: true });

        Logger.info(`✅ sync:admin 同步成功`);
        Logger.info(`📊 统计: 创建 ${stats.created} 个, 更新 ${stats.updated} 个, 跳过 ${stats.skipped} 个`);
    } catch (error: any) {
        Logger.error(`❌ sync:admin 同步失败: ${error.message}`);

        if (existsSync(tempDir)) {
            await rm(tempDir, { recursive: true, force: true });
        }

        throw error;
    }
}
