/**
 * Sync 命令 - 一次性执行所有同步操作
 * 按顺序执行：syncDb → syncApi → syncMenu → syncDev
 */

import { Env } from 'befly';
import { Logger } from '../util.js';
import { syncDbCommand } from './syncDb.js';
import { syncApiCommand } from './syncApi.js';
import { syncMenuCommand } from './syncMenu.js';
import { syncDevCommand } from './syncDev.js';
import { existsSync, mkdirSync } from 'node:fs';
import { ReportCollector } from '../utils/reportCollector.js';
import { generateReportHTML } from '../utils/reportGenerator.js';
import type { SyncDbStats, SyncApiStats, SyncMenuStats, SyncDevStats, SyncOptions } from '../types.js';

export async function syncCommand(options: SyncOptions = {}) {
    const collector = ReportCollector.getInstance();
    collector.reset();

    try {
        const startTime = Date.now();

        // 确保 logs 目录存在
        if (!existsSync('./logs')) {
            mkdirSync('./logs', { recursive: true });
        }

        Logger.info('开始执行同步任务...\n');

        // 1. 同步数据库表结构
        Logger.info('📦 正在同步数据库...');
        const dbStats = await syncDbCommand({ dryRun: false });
        Logger.info(`✓ 数据库同步完成 (处理 ${dbStats.processedTables} 个表)\n`);

        // 2. 同步接口（并缓存）
        Logger.info('🔌 正在同步接口...');
        const apiStats = await syncApiCommand();
        Logger.info(`✓ 接口同步完成 (总计 ${apiStats.totalApis} 个)\n`);

        // 3. 同步菜单（并缓存）
        Logger.info('� 正在同步菜单...');
        const menuStats = await syncMenuCommand();
        Logger.info(`✓ 菜单同步完成 (总计 ${menuStats.totalMenus} 个)\n`);

        // 4. 同步开发管理员（并缓存角色权限）
        Logger.info('� 正在同步开发账号...');
        const devStats = await syncDevCommand();
        Logger.info(`✓ 开发账号同步完成\n`);

        // 生成同步报告
        const totalTime = Date.now() - startTime;
        collector.setTotalTime(totalTime);
        collector.setStatus('success');

        const report = collector.getData();

        // 确保 logs/data 目录存在
        if (!existsSync('./logs/data')) {
            mkdirSync('./logs/data', { recursive: true });
        }

        // 生成时间戳文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

        // 保存 JSON 报告
        const jsonPath = `./logs/data/sync-${timestamp}.json`;
        await Bun.write(jsonPath, JSON.stringify(report, null, 2));

        // 生成 HTML 报告
        const htmlPath = `./logs/sync-${timestamp}.html`;
        const html = generateReportHTML(report);
        await Bun.write(htmlPath, html);

        // 输出总结
        const totalTimeSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
        Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        Logger.info(`✅ 同步完成！总耗时: ${totalTimeSeconds} 秒`);
        Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        Logger.info(`\n📄 同步报告已生成:`);
        Logger.info(`   JSON: ${jsonPath}`);
        Logger.info(`   HTML: ${htmlPath}`);
        Logger.info(`\n💡 在浏览器中打开 HTML 文件查看详细报告\n`);
    } catch (error: any) {
        Logger.error('同步过程中发生错误:', error);
        collector.setStatus('error', error.message);

        // 即使出错也生成报告
        const report = collector.getData();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

        try {
            if (!existsSync('./logs/data')) {
                mkdirSync('./logs/data', { recursive: true });
            }
            const jsonPath = `./logs/data/sync-${timestamp}-error.json`;
            await Bun.write(jsonPath, JSON.stringify(report, null, 2));
            Logger.info(`\n📄 错误报告已生成: ${jsonPath}`);
        } catch (reportError) {
            Logger.error('生成错误报告失败:', reportError);
        }

        process.exit(1);
    }
}
