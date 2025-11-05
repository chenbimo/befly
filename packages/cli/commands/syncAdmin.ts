/**
 * Sync Admin 命令 - 同步前端 admin 模板
 */

import { join, relative, dirname } from 'pathe';
import { rm, readdir, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { Logger, downloadPackage, copyDirRecursive, isInternalPath, shouldExclude } from '../util.js';

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
    try {
        // 1. 下载包
        const { version, packageDir, cleanup } = await downloadPackage('befly-admin', 'https://registry.npmmirror.com/befly-admin/latest');

        // 2. 同步所有文件和目录
        Logger.info('正在同步文件...');
        const targetDir = process.cwd();
        const stats = await syncDirectory(packageDir, targetDir, packageDir);

        // 3. 清理临时目录
        await cleanup();

        Logger.info(`✅ sync:admin 同步成功`);
        Logger.info(`📊 统计: 创建 ${stats.created} 个, 更新 ${stats.updated} 个, 跳过 ${stats.skipped} 个`);
    } catch (error: any) {
        Logger.error(`❌ sync:admin 同步失败: ${error.message}`);
        throw error;
    }
}
