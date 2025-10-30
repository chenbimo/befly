/**
 * Build、Start、Sync、Addon、SyncApi、SyncMenu、SyncDev 命令实现
 */

import { join } from 'pathe';
import { existsSync } from 'node:fs';
import ora from 'ora';
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

        const spinner = ora({
            text: '正在构建项目...',
            color: 'cyan',
            spinner: 'dots'
        }).start();

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
            spinner.succeed('项目构建完成');
            Logger.success(`输出目录: ${options.outdir}`);
        } else {
            spinner.fail('项目构建失败');
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

        const spinner = ora({
            text: '正在同步数据库表...',
            color: 'cyan',
            spinner: 'dots'
        }).start();

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
            spinner.succeed('数据库同步完成');
        } else {
            spinner.fail('数据库同步失败');
            process.exit(1);
        }
    } catch (error) {
        Logger.error('同步失败:');
        console.error(error);
        process.exit(1);
    }
}

// ========== Addon 命令 ==========
export const addonCommand = {
    async install(name: string, options: { source?: string }) {
        const spinner = ora({
            text: `正在安装插件: ${name}`,
            color: 'cyan',
            spinner: 'dots'
        }).start();

        try {
            // TODO: 实现插件安装逻辑
            // 1. 从 source 或默认源下载插件
            // 2. 解压到 addons 目录
            // 3. 安装插件依赖
            // 4. 执行插件安装脚本

            spinner.succeed(`插件 ${name} 安装成功`);
        } catch (error) {
            spinner.fail(`插件 ${name} 安装失败`);
            throw error;
        }
    },

    async uninstall(name: string, options: { keepData: boolean }) {
        const spinner = ora({
            text: `正在卸载插件: ${name}`,
            color: 'cyan',
            spinner: 'dots'
        }).start();

        try {
            // TODO: 实现插件卸载逻辑
            // 1. 执行插件卸载脚本
            // 2. 删除插件文件
            // 3. 可选：删除插件数据

            spinner.succeed(`插件 ${name} 卸载成功`);
        } catch (error) {
            spinner.fail(`插件 ${name} 卸载失败`);
            throw error;
        }
    },

    async list() {
        try {
            const projectRoot = getProjectRoot();
            const addonsDir = join(projectRoot, 'addons');

            if (!existsSync(addonsDir)) {
                Logger.info('未找到 addons 目录');
                return;
            }

            // TODO: 读取已安装的插件列表
            Logger.info('已安装的插件:\n');
            Logger.info('(功能开发中)');
        } catch (error) {
            Logger.error('获取插件列表失败:');
            console.error(error);
        }
    }
};

// ========== 导出新增的同步命令 ==========
export { syncApiCommand } from './syncApi.js';
export { syncMenuCommand } from './syncMenu.js';
export { syncDevCommand } from './syncDev.js';
