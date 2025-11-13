/**
 * Sync 命令 - 一次性执行所有同步操作
 * 按顺序执行：syncDb → syncApi → syncMenu → syncDev
 */

import { checkApp } from 'befly';
import { Logger } from '../util.js';
import { syncDbCommand } from './syncDb.js';
import { syncApiCommand } from './syncApi.js';
import { syncMenuCommand } from './syncMenu.js';
import { syncDevCommand } from './syncDev.js';
import type { SyncOptions } from '../types.js';

export async function syncAllCommand(options: SyncOptions = {}) {
    try {
        const startTime = Date.now();

        // 0. 检查项目结构
        Logger.info('🔍 正在检查项目结构...');
        const checkResult = await checkApp();
        if (!checkResult) {
            Logger.error('项目结构检查失败，程序退出');
            process.exit(1);
        }
        Logger.info(`✓ 项目结构检查完成\n`);

        Logger.info('开始执行同步任务...\n');

        // 1. 同步数据库表结构
        Logger.info('📦 正在同步数据库...');
        await syncDbCommand({ dryRun: false, force: options.force || false });
        Logger.info(`✓ 数据库同步完成\n`);

        // 2. 同步接口（并缓存）
        Logger.info('🔌 正在同步接口...');
        await syncApiCommand();
        Logger.info(`✓ 接口同步完成\n`);

        // 3. 同步菜单（并缓存）
        Logger.info('📋 正在同步菜单...');
        await syncMenuCommand();
        Logger.info(`✓ 菜单同步完成\n`);

        // 4. 同步开发管理员（并缓存角色权限）
        Logger.info('👤 正在同步开发账号...');
        await syncDevCommand();
        Logger.info(`✓ 开发账号同步完成\n`);

        // 输出总结
        const totalTimeSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
        Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        Logger.info(`✅ 同步完成！总耗时: ${totalTimeSeconds} 秒`);
        Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (error: any) {
        Logger.error('同步过程中发生错误:', error);
        process.exit(1);
    }
}
