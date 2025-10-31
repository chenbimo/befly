/**
 * SyncDb 命令 - 同步数据库表结构
 */

import { Command } from 'commander';
import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { Logger } from '../lib/logger.js';
import { SyncDb, type SyncDbStats } from './syncDb/index.js';

interface SyncDbOptions {
    table?: string;
    dryRun: boolean;
}

export async function syncDbCommand(options: SyncDbOptions): Promise<SyncDbStats> {
    try {
        // 设置环境变量
        if (options.dryRun) {
            process.env.SYNC_DRY_RUN = '1';
        }

        if (options.table) {
            process.env.SYNC_TABLE = options.table;
        }

        // 执行同步并返回统计
        const stats = await SyncDb();
        return stats;
    } catch (error: any) {
        Logger.error('数据库同步失败:', error);
        process.exit(1);
    }
}
