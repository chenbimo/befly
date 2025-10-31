/**
 * SyncDb 命令 - 同步数据库表结构
 */

import { Command } from 'commander';
import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { Logger } from '../lib/logger.js';
import { SyncDb } from './syncDb/index.js';

interface SyncDbOptions {
    table?: string;
    dryRun: boolean;
}

export async function syncDbCommand(options: SyncDbOptions) {
    try {
        // 设置环境变量
        if (options.dryRun) {
            process.env.SYNC_DRY_RUN = '1';
        }

        if (options.table) {
            process.env.SYNC_TABLE = options.table;
        }

        // 执行同步
        await SyncDb();
        Logger.info('数据库表结构同步完成');
    } catch (error: any) {
        Logger.error('数据库同步失败:', error);
        process.exit(1);
    }
}
