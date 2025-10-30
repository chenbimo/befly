/**
 * Build 命令 - 构建项目
 */

import { join } from 'pathe';
import { existsSync } from 'node:fs';
import ora from 'ora';
import { Logger } from '../lib/logger.js';

function getProjectRoot(): string {
    let current = process.cwd();
    const path = require('node:path');
    while (current !== path.parse(current).root) {
        if (existsSync(join(current, 'package.json'))) {
            return current;
        }
        current = path.dirname(current);
    }
    return process.cwd();
}

interface BuildOptions {
    outdir: string;
    minify: boolean;
    sourcemap: boolean;
}

export async function buildCommand(options: BuildOptions) {
    try {
        const projectRoot = getProjectRoot();

        // 验证是否在项目目录下
        const packageJsonPath = join(projectRoot, 'package.json');
        if (!existsSync(packageJsonPath)) {
            Logger.error('未找到 package.json 文件，请确保在项目目录下');
            process.exit(1);
        }

        // 使用内置默认入口文件
        const entryFile = join(import.meta.dir, '..', 'entry.ts');

        const spinner = ora({
            text: '正在构建项目...',
            color: 'cyan',
            spinner: 'dots'
        }).start();

        const args = ['build', entryFile, '--outdir', options.outdir, '--target', 'bun'];

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
