/**
 * syncDb 主入口文件
 *
 * 功能：
 * - 协调所有模块，执行数据库表结构同步
 * - 处理核心表、项目表、addon 表
 * - 提供统计信息和错误处理
 */

import path from 'node:path';
import { Logger } from '../../utils/logger.js';

// 从 befly 核心包导入依赖
import { Env, util, checkTable, paths } from 'befly';

// 导入模块化的功能
import { ensureDbVersion } from './version.js';
import { tableExists } from './schema.js';
import { createTable, modifyTable } from './table.js';
import { PerformanceTracker, ProgressLogger } from './state.js';
import type { SQL } from 'bun';

// 全局 SQL 客户端实例
let sql: SQL | null = null;

// 全局统计对象
const globalCount: Record<string, number> = {
    processedTables: 0,
    createdTables: 0,
    modifiedTables: 0,
    addFields: 0,
    nameChanges: 0,
    typeChanges: 0,
    minChanges: 0,
    maxChanges: 0,
    defaultChanges: 0,
    indexCreate: 0,
    indexDrop: 0
};

/**
 * 主同步函数
 *
 * 流程：
 * 1. 验证表定义文件
 * 2. 建立数据库连接并检查版本
 * 3. 扫描表定义文件（核心表、项目表、addon表）
 * 4. 对比并应用表结构变更
 * 5. 输出统计信息
 */
export const SyncDb = async (): Promise<void> => {
    const perfTracker = new PerformanceTracker();
    const progressLogger = new ProgressLogger();

    try {
        Logger.info('开始数据库表结构同步...');

        // 重置全局统计，避免多次调用累加
        for (const k of Object.keys(globalCount)) {
            if (typeof globalCount[k] === 'number') globalCount[k] = 0;
        }

        // 阶段1：验证表定义文件
        perfTracker.markPhase('表定义验证');
        if (!(await checkTable())) {
            throw new Error('表定义验证失败');
        }
        Logger.info(`✓ 表定义验证完成，耗时: ${perfTracker.getPhaseTime('表定义验证')}`);

        // 阶段2：建立数据库连接并检查版本
        perfTracker.markPhase('数据库连接');
        sql = await util.createSqlClient({ max: 1 });
        await ensureDbVersion(sql);
        Logger.info(`✓ 数据库连接建立，耗时: ${perfTracker.getPhaseTime('数据库连接')}`);

        // 阶段3：扫描表定义文件
        perfTracker.markPhase('扫描表文件');
        const tablesGlob = new Bun.Glob('*.json');
        const directories: Array<{ path: string; isCore: boolean; addonName?: string }> = [{ path: paths.projectTableDir, isCore: false }];

        // 添加所有 addon 的 tables 目录
        const addons = util.scanAddons();
        for (const addon of addons) {
            if (util.addonDirExists(addon, 'tables')) {
                directories.push({
                    path: util.getAddonDir(addon, 'tables'),
                    isCore: false,
                    addonName: addon
                });
            }
        }

        // 统计表文件总数
        let totalTables = 0;
        for (const dirConfig of directories) {
            for await (const file of tablesGlob.scan({
                cwd: dirConfig.path,
                absolute: true,
                onlyFiles: true
            })) {
                const fileName = path.basename(file, '.json');
                if (!fileName.startsWith('_')) {
                    totalTables++;
                }
            }
        }
        perfTracker.finishPhase('扫描表文件');
        Logger.info(`✓ 扫描完成，发现 ${totalTables} 个表定义文件，耗时: ${perfTracker.getPhaseTime('扫描表文件')}`);

        // 阶段4：处理表文件
        perfTracker.markPhase('同步处理');
        let processedCount = 0;

        for (const dirConfig of directories) {
            const { path: dir, isCore, addonName } = dirConfig;
            const dirType = addonName ? `组件${addonName}` : '项目';

            for await (const file of tablesGlob.scan({
                cwd: dir,
                absolute: true,
                onlyFiles: true
            })) {
                const fileName = path.basename(file, '.json');

                // 跳过以下划线开头的文件（这些是公共字段规则，不是表定义）
                if (fileName.startsWith('_')) {
                    Logger.info(`跳过非表定义文件: ${fileName}.json`);
                    continue;
                }

                // 确定表名：
                // - addon 表：addon_{转换后的addonName}_{表名}
                //   例如：addon-admin 的 user.json → addon_admin_user
                // - 项目表：{表名}
                //   例如：user.json → user
                let tableName = util.toSnakeCase(fileName);
                if (addonName) {
                    // 将 addon 名称中的中划线替换为下划线（addon-admin → addon_admin）
                    const addonNameSnake = addonName.replace(/-/g, '_');
                    tableName = `${addonNameSnake}_${tableName}`;
                }

                processedCount++;
                progressLogger.logTableProgress(processedCount, totalTables, tableName);
                Logger.info(`  类型: ${dirType}`);

                const tableDefinition = await Bun.file(file).json();
                const existsTable = await tableExists(sql!, tableName);

                if (existsTable) {
                    await modifyTable(sql!, tableName, tableDefinition, globalCount);
                } else {
                    await createTable(sql!, tableName, tableDefinition);
                    globalCount.createdTables++;
                }
                globalCount.processedTables++;
            }
        }

        perfTracker.finishPhase('同步处理');
        Logger.info(`✓ 表处理完成，耗时: ${perfTracker.getPhaseTime('同步处理')}`);

        // 阶段5：显示统计信息
        Logger.info('\n=== 同步统计信息 ===');
        Logger.info(`总耗时: ${perfTracker.getTotalTime()}`);
        Logger.info(`处理表总数: ${globalCount.processedTables}`);
        Logger.info(`创建表: ${globalCount.createdTables}`);
        Logger.info(`修改表: ${globalCount.modifiedTables}`);
        Logger.info(`字段新增: ${globalCount.addFields}`);
        Logger.info(`字段名称变更: ${globalCount.nameChanges}`);
        Logger.info(`字段类型变更: ${globalCount.typeChanges}`);
        Logger.info(`字段最小值变更: ${globalCount.minChanges}`);
        Logger.info(`字段最大值变更: ${globalCount.maxChanges}`);
        Logger.info(`字段默认值变更: ${globalCount.defaultChanges}`);
        Logger.info(`索引新增: ${globalCount.indexCreate}`);
        Logger.info(`索引删除: ${globalCount.indexDrop}`);

        if (globalCount.processedTables === 0) {
            Logger.warn('没有找到任何表定义文件');
        }

        // 输出性能统计
        perfTracker.logStats();
    } catch (error: any) {
        Logger.error(`数据库同步失败`, error);
        process.exit(1);
    } finally {
        if (sql) {
            try {
                await sql.close();
            } catch (error: any) {
                Logger.warn('关闭数据库连接时出错:', error.message);
            }
        }
    }
};

// 如果直接运行此脚本（Bun 支持 import.meta.main）
if (import.meta.main) {
    SyncDb().catch((error) => {
        Logger.error('数据库同步失败', error);
        process.exit(1);
    });
}
