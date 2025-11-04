/**
 * Sync Admin 命令 - 同步前端 admin 模板
 * 下载 befly-admin 包并同步所有 internal 目录
 */

import { join, relative } from 'pathe';
import { tmpdir } from 'node:os';
import { rm, readdir, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { Logger } from '../util.js';
import { Glob } from 'bun';
import extract from 'fast-extract';

/**
 * 递归复制目录
 */
async function copyDir(source: string, target: string): Promise<void> {
    // 创建目标目录
    if (!existsSync(target)) {
        await mkdir(target, { recursive: true });
    }

    const entries = await readdir(source, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = join(source, entry.name);
        const targetPath = join(target, entry.name);

        if (entry.isDirectory()) {
            // 递归复制子目录
            await copyDir(sourcePath, targetPath);
        } else {
            // 复制文件
            await copyFile(sourcePath, targetPath);
        }
    }
}

/**
 * 查找所有 internal 目录（使用 Bun.Glob 模糊匹配）
 */
async function findInternalDirs(baseDir: string): Promise<string[]> {
    const glob = new Glob('**/internal');
    const internalDirs: string[] = [];

    for await (const file of glob.scan({
        cwd: baseDir,
        onlyFiles: false,
        absolute: true
    })) {
        // 过滤掉 node_modules 下的目录
        if (!file.includes('node_modules')) {
            internalDirs.push(file);
        }
    }

    return internalDirs;
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

        // 3. 扫描并同步 internal 目录
        const srcDir = join(extractDir, 'package', 'src');
        if (!existsSync(srcDir)) {
            throw new Error('下载的包中没有 src 目录');
        }

        const internalDirs = await findInternalDirs(srcDir);
        if (internalDirs.length === 0) {
            throw new Error('未找到 internal 目录');
        }

        Logger.info(`正在同步 ${internalDirs.length} 个目录...`);

        for (const sourceDir of internalDirs) {
            const relativePath = relative(srcDir, sourceDir);
            const targetDir = join(process.cwd(), 'src', relativePath);

            if (existsSync(targetDir)) {
                await rm(targetDir, { recursive: true, force: true });
            }

            await copyDir(sourceDir, targetDir);
            Logger.debug(`${relativePath} 已同步`);
        }

        // 4. 清理临时目录
        await rm(tempDir, { recursive: true, force: true });

        Logger.info(`✅ sync:admin 同步成功`);
    } catch (error: any) {
        Logger.error(`❌ sync:admin 同步失败: ${error.message}`);

        if (existsSync(tempDir)) {
            await rm(tempDir, { recursive: true, force: true });
        }

        throw error;
    }
}
