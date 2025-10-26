/**
 * Sync 命令 - 同步数据库表
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

        const spinner = Spinner.start('正在同步数据库表...');

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
