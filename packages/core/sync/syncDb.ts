/**
 * SyncDb 命令 - 同步数据库表结构
 */

import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { Logger } from '../lib/logger.js';
import { SyncDb } from './syncDb/index.js';
import type { SyncDbOptions, BeflyOptions } from '../types/index.js';

export async function syncDbCommand(config: BeflyOptions, options: SyncDbOptions): Promise<void> {
    try {
        // 执行同步
        await SyncDb(config, options);
    } catch (error: any) {
        Logger.error('数据库同步失败', error);
        throw error;
    }
}
