/**
 * Build、Start、Sync、SyncApi、SyncMenu、SyncDev 命令实现
 */

import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { Logger } from '../lib/logger.js';
import { getProjectRoot } from './util.js';

// ========== Build 命令 ==========
interface BuildOptions {
    outdir: string;
    minify: boolean;
    sourcemap: boolean;
}

export async function buildCommand(options: BuildOptions) {
    try {
        const projectRoot = getProjectRoot();
        const mainFile = join(projectRoot, 'main.ts');

        if (!existsSync(mainFile)) {
            Logger.error('未找到 main.ts 文件');
            process.exit(1);
        }

        Logger.info('正在构建项目...');

        const args = ['build', mainFile, '--outdir', options.outdir, '--target', 'bun'];

        if (options.minify) {
            args.push('--minify');
        }

        if (options.sourcemap) {
            args.push('--sourcemap');
        }

        const proc = Bun.spawn(['bun', ...args], {
            cwd: projectRoot,
            stdout: 'pipe',
            stderr: 'pipe'
        });

        await proc.exited;

        if (proc.exitCode === 0) {
            Logger.success('项目构建完成');
            Logger.success(`输出目录: ${options.outdir}`);
        } else {
            Logger.error('项目构建失败');
            process.exit(1);
        }
    } catch (error) {
        Logger.error('构建失败:');
        console.error(error);
        process.exit(1);
    }
}

// ========== Start 命令 ==========
interface StartOptions {
    port: string;
    host: string;
}

export async function startCommand(options: StartOptions) {
    try {
        const projectRoot = getProjectRoot();
        const mainFile = join(projectRoot, 'main.ts');

        if (!existsSync(mainFile)) {
            Logger.error('未找到 main.ts 文件');
            process.exit(1);
        }

        process.env.NODE_ENV = 'production';
        process.env.APP_PORT = options.port;
        process.env.APP_HOST = options.host;

        Logger.info('正在启动生产服务器...\n');
        Logger.info(`端口: ${options.port}`);
        Logger.info(`主机: ${options.host}`);
        Logger.info(`环境: production\n`);

        const proc = Bun.spawn(['bun', 'run', mainFile], {
            cwd: projectRoot,
            stdout: 'inherit',
            stderr: 'inherit',
            stdin: 'inherit',
            env: {
                ...process.env,
                FORCE_COLOR: '1'
            }
        });

        await proc.exited;
        process.exit(proc.exitCode || 0);
    } catch (error) {
        Logger.error('启动失败:');
        console.error(error);
        process.exit(1);
    }
}

// ========== Sync 命令 ==========
interface SyncOptions {
    table?: string;
    force: boolean;
    dryRun: boolean;
    drop: boolean;
}

export async function syncCommand(options: SyncOptions) {
    try {
        const projectRoot = getProjectRoot();
        const syncScript = join(projectRoot, 'node_modules', 'befly', 'scripts', 'syncTable.ts');

        if (!existsSync(syncScript)) {
            Logger.error('未找到同步脚本，请确保已安装 befly');
            process.exit(1);
        }

        Logger.info('正在同步数据库表...');

        const args = ['run', syncScript];

        if (options.table) {
            args.push('--table', options.table);
        }

        if (options.force) {
            args.push('--force');
        }

        if (options.dryRun) {
            args.push('--dry-run');
        }

        if (options.drop) {
            args.push('--drop');
        }

        const proc = Bun.spawn(['bun', ...args], {
            cwd: projectRoot,
            stdout: 'inherit',
            stderr: 'inherit',
            stdin: 'inherit'
        });

        await proc.exited;

        if (proc.exitCode === 0) {
            Logger.success('数据库同步完成');
        } else {
            Logger.error('数据库同步失败');
            process.exit(1);
        }
    } catch (error) {
        Logger.error('同步失败:');
        console.error(error);
        process.exit(1);
    }
}

// ========== 导出同步命令 ==========
export { syncApiCommand } from './syncApi.js';
export { syncMenuCommand } from './syncMenu.js';
export { syncDevCommand } from './syncDev.js';
