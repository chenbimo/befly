/**
 * Sync 命令实现
 */

import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { Logger } from '../lib/logger.js';
import { getProjectRoot } from '../util.js';
import type { SyncOptions } from '../types.js';

// ========== Sync 命令 ==========

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
