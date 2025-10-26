/**
 * Build 命令 - 构建项目
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

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
        const mainFile = join(projectRoot, 'main.ts');

        if (!existsSync(mainFile)) {
            Logger.error('未找到 main.ts 文件');
            process.exit(1);
        }

        const spinner = Spinner.start('正在构建项目...');

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
