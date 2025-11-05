/**
 * Commands 工具函数
 * 提供命令间可复用的通用功能
 */

import { join, parse, dirname, relative, normalize, sep } from 'pathe';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Env } from 'befly';
import extract from 'fast-extract';

export const projectDir = process.cwd();

/**
 * CLI Logger 工具
 * 提供统一的日志输出功能
 */
export const Logger = {
    /**
     * 普通日志
     */
    log(...args: any[]) {
        console.log(...args);
    },

    /**
     * 信息日志（蓝色）
     */
    info(...args: any[]) {
        console.log('\x1b[34m%s\x1b[0m', ...args);
    },

    /**
     * 成功日志（绿色）
     */
    success(...args: any[]) {
        console.log('\x1b[32m%s\x1b[0m', ...args);
    },

    /**
     * 警告日志（黄色）
     */
    warn(...args: any[]) {
        console.warn('\x1b[33m%s\x1b[0m', ...args);
    },

    /**
     * 错误日志（红色）
     */
    error(...args: any[]) {
        console.error('\x1b[31m%s\x1b[0m', ...args);
    },

    /**
     * 调试日志（灰色）
     */
    debug(...args: any[]) {
        console.log('\x1b[90m%s\x1b[0m', ...args);
    },

    /**
     * 打印当前运行环境
     * 用于命令开始时提示用户当前环境
     */
    printEnv() {
        console.log('========================================');
        console.log('开始执行完整同步流程');
        console.log(`当前环境: ${Env.NODE_ENV || 'development'}`);
        console.log(`项目名称: ${Env.APP_NAME || '-'}`);
        console.log(`数据库地址: ${Env.DB_HOST || '-'}`);
        console.log(`数据库名称: ${Env.DB_NAME || '-'}`);
        console.log('========================================\n');
    }
};

/**
 * 读取 package.json 文件内容
 *
 * @param pkgPath package.json 文件路径
 * @returns package.json 的内容对象
 */
export function readPackageJson(pkgPath: string): Record<string, any> {
    try {
        const content = readFileSync(pkgPath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`读取 package.json 失败: ${error}`);
    }
}

/**
 * 获取指定目录的 package.json 版本号
 *
 * @param dir 目录路径
 * @returns 版本号字符串
 */
export function getPackageVersion(dir: string): string {
    try {
        const pkgPath = join(dir, 'package.json');
        const pkg = readPackageJson(pkgPath);
        return pkg.version || '0.0.0';
    } catch (error) {
        return '0.0.0';
    }
}

/**
 * 检查目录是否为空或只包含隐藏文件
 */
export async function isDirectoryEmpty(dirPath: string): Promise<boolean> {
    if (!existsSync(dirPath)) {
        return true;
    }

    const entries = await readdir(dirPath);

    // 过滤掉以 . 开头的文件和目录
    const nonHiddenFiles = entries.filter((entry) => !entry.startsWith('.'));

    return nonHiddenFiles.length === 0;
}

/**
 * 递归复制目录
 */
export async function copyDirRecursive(source: string, target: string): Promise<{ copied: number }> {
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
 * 判断路径是否在 internal 目录内
 */
export function isInternalPath(filePath: string, baseDir: string): boolean {
    const rel = normalize(relative(baseDir, filePath));
    const parts = rel.split(sep);
    return parts.includes('internal');
}

/**
 * 判断路径是否应该被排除
 */
export function shouldExclude(filePath: string, baseDir: string): boolean {
    const rel = normalize(relative(baseDir, filePath));
    const parts = rel.split(sep);

    if (parts.includes('node_modules')) {
        return true;
    }

    return false;
}

/**
 * 从 npm 下载包
 */
export async function downloadPackage(packageName: string, registry: string): Promise<{ version: string; packageDir: string; cleanup: () => Promise<void> }> {
    const cacheDir = join(tmpdir(), 'befly-cache');
    const tempDir = join(cacheDir, `${packageName}-${Date.now()}`);
    const tarballPath = join(tempDir, 'package.tgz');
    const extractDir = join(tempDir, 'extracted');

    try {
        await mkdir(tempDir, { recursive: true });

        // 获取并下载最新版本
        Logger.info(`正在获取 ${packageName} 最新版本...`);
        const metaData = await fetch(registry).then((res) => res.json());

        Logger.info(`正在下载 ${packageName}@${metaData.version}...`);
        await Bun.write(tarballPath, await fetch(metaData.dist.tarball).then((res) => res.arrayBuffer()));

        // 解压
        Logger.info('正在解压...');
        await extract(tarballPath, extractDir, { strip: 0 });

        const packageDir = join(extractDir, 'package');
        if (!existsSync(packageDir)) {
            throw new Error('下载的包结构异常');
        }

        // 返回清理函数
        const cleanup = async () => {
            if (existsSync(tempDir)) {
                await rm(tempDir, { recursive: true, force: true });
            }
        };

        return {
            version: metaData.version,
            packageDir: packageDir,
            cleanup: cleanup
        };
    } catch (error) {
        // 清理临时目录
        if (existsSync(tempDir)) {
            await rm(tempDir, { recursive: true, force: true });
        }
        throw error;
    }
}
