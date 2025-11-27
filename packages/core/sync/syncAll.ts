/**
 * Sync 命令 - 一次性执行所有同步操作
 * 按顺序执行：syncDb → syncApi → syncMenu → syncDev
 */

import { checkApp } from '../checks/checkApp.js';
import { Logger } from '../lib/logger.js';
import { syncDbCommand } from './syncDb.js';
import { syncApiCommand } from './syncApi.js';
import { syncMenuCommand } from './syncMenu.js';
import { syncDevCommand } from './syncDev.js';
import type { SyncOptions, BeflyOptions } from '../types/index.js';

export async function syncAllCommand(config: BeflyOptions, options: SyncOptions = {}) {
    try {
        const startTime = Date.now();

        // 0. 检查项目结构
        await checkApp();

        // 1. 同步数据库表结构
        await syncDbCommand(config, { dryRun: false, force: options.force || false });

        // 2. 同步接口（并缓存）
        await syncApiCommand(config);

        // 3. 同步菜单（并缓存）
        await syncMenuCommand(config);

        // 4. 同步开发管理员（并缓存角色权限）
        await syncDevCommand(config);

        // 输出总结
        const totalTimeSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
        Logger.info(`同步完成 (耗时 ${totalTimeSeconds}s)`);
    } catch (error: any) {
        Logger.error('同步过程中发生错误', error);
        throw error;
    }
}
