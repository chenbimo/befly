/**
 * Sync Admin 命令 - 同步前端 admin 模板
 * 使用 pacote 下载 befly-admin 包并同步所有 internal 目录
 */

import pacote from 'pacote';
import { join } from 'pathe';
import { tmpdir } from 'node:os';
import { rm, cp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { Logger } from '../util.js';

/**
 * 递归查找所有 internal 目录
 */
async function findInternalDirs(baseDir: string): Promise<string[]> {
    const internalDirs: string[] = [];
    const entries = await readdir(baseDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const fullPath = join(baseDir, entry.name);

        if (entry.name === 'internal') {
            internalDirs.push(fullPath);
        } else if (entry.name !== 'node_modules') {
            internalDirs.push(...(await findInternalDirs(fullPath)));
        }
    }

    return internalDirs;
}

/**
 * Sync Admin 命令
 */
export async function syncAdminCommand() {
    const tempDir = join(tmpdir(), `befly-admin-${Date.now()}`);

    try {
        Logger.info('正在下载 befly-admin...');

        // 1. 下载 befly-admin（自动读取 .npmrc）
        await pacote.extract('befly-admin', tempDir);

        Logger.info('正在同步 internal 目录...');

        // 2. 扫描所有 internal 目录
        const internalDirs = await findInternalDirs(join(tempDir, 'src'));

        if (internalDirs.length === 0) {
            throw new Error('未找到 internal 目录');
        }

        // 3. 同步每个 internal 目录
        for (const sourceDir of internalDirs) {
            const relativePath = sourceDir.replace(join(tempDir, 'src'), '');
            const targetDir = join(process.cwd(), 'src', relativePath);

            // 删除旧目录
            if (existsSync(targetDir)) {
                await rm(targetDir, { recursive: true, force: true });
            }

            // 复制新目录
            await cp(sourceDir, targetDir, { recursive: true });
        }

        // 4. 清理临时目录
        await rm(tempDir, { recursive: true, force: true });

        Logger.info(`✅ sync:admin 同步成功（${internalDirs.length} 个目录）`);
    } catch (error: any) {
        Logger.error(`❌ sync:admin 同步失败: ${error.message}`);

        // 清理临时目录
        if (existsSync(tempDir)) {
            await rm(tempDir, { recursive: true, force: true });
        }

        throw error;
    }
}
