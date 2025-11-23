/**
 * SyncDb 命令 - 同步数据库表结构
 */

import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { Logger } from '../lib/logger.js';
import { SyncDb } from './syncDb/index.js';
import type { SyncDbOptions } from '../types.js';

export async function syncDbCommand(options: SyncDbOptions): Promise<void> {
    try {
        // 设置环境变量
        if (options.dryRun) {
            process.env.SYNC_DRY_RUN = '1';
        }

        if (options.table) {
            process.env.SYNC_TABLE = options.table;
        }

        if (options.force) {
            process.env.SYNC_FORCE = '1';
        }

        // 执行同步
        await SyncDb();
    } catch (error: any) {
        Logger.error('数据库同步失败', error);
        throw error;
    }
}
