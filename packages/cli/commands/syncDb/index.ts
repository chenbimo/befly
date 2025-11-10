/**
 * syncDb 主入口文件
 *
 * 功能：
 * - 协调所有模块，执行数据库表结构同步
 * - 处理核心表、项目表、addon 表
 * - 提供统计信息和错误处理
 */

import { basename, resolve } from 'pathe';
import { snakeCase } from 'es-toolkit/string';
import { Env, Database, RedisHelper, checkTable, utils } from 'befly';
import { Logger, projectDir } from '../../util.js';

// 导入模块化的功能
import { ensureDbVersion } from './version.js';
import { tableExists } from './schema.js';
import { modifyTable } from './table.js';
import { createTable } from './tableCreate.js';
import { PerformanceTracker, ProgressLogger } from './state.js';
import type { SQL } from 'bun';
import type { SyncDbStats } from '../../types.js';

// 全局 SQL 客户端实例
let sql: SQL | null = null;

// 记录处理过的表名（用于清理缓存）
const processedTables: string[] = [];

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
 * 5. 返回统计信息
 */
export const SyncDb = async (): Promise<SyncDbStats> => {
    const perfTracker = new PerformanceTracker();
    const progressLogger = new ProgressLogger();

    try {
        // 重置全局统计，避免多次调用累加
        for (const k of Object.keys(globalCount)) {
            if (typeof globalCount[k] === 'number') globalCount[k] = 0;
        }

        // 清空处理记录
        processedTables.length = 0;

        // 阶段1：验证表定义文件
        perfTracker.markPhase('表定义验证');
        await checkTable();

        // 阶段2：建立数据库连接并检查版本
        perfTracker.markPhase('数据库连接');
        sql = await Database.connectSql({ max: 1 });
        await ensureDbVersion(sql);

        // 初始化 Redis 连接（用于清理缓存）
        await Database.connectRedis();

        // 阶段3：扫描表定义文件
        perfTracker.markPhase('扫描表文件');
        const tablesGlob = new Bun.Glob('*.json');
        const directories: Array<{ path: string; type: 'app' | 'addon'; addonName?: string }> = [
            // 1. 项目表（无前缀）
            { path: resolve(projectDir, 'tables'), type: 'app' }
        ];

        // 添加所有 addon 的 tables 目录（addon_{name}_ 前缀）
        const addons = utils.scanAddons();
        for (const addon of addons) {
            if (utils.addonDirExists(addon, 'tables')) {
                directories.push({
                    path: utils.getAddonDir(addon, 'tables'),
                    type: 'addon',
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
                const fileName = basename(file, '.json');
                if (!fileName.startsWith('_')) {
                    totalTables++;
                }
            }
        }
        perfTracker.finishPhase('扫描表文件');

        // 阶段4：处理表文件
        perfTracker.markPhase('同步处理');
        let processedCount = 0;

        for (const dirConfig of directories) {
            const { path: dir, type, addonName } = dirConfig;
            const dirType = type === 'addon' ? `组件${addonName}` : '项目';

            for await (const file of tablesGlob.scan({
                cwd: dir,
                absolute: true,
                onlyFiles: true
            })) {
                const fileName = basename(file, '.json');

                // 跳过以下划线开头的文件（这些是公共字段规则，不是表定义）
                if (fileName.startsWith('_')) {
                    continue;
                }

                // 确定表名：
                // - addon 表：{addonName}_{表名}
                //   例如：admin addon 的 user.json → admin_user
                // - 项目表：{表名}
                //   例如：user.json → user
                let tableName = snakeCase(fileName);
                if (type === 'addon' && addonName) {
                    // addon 表，添加 {addonName}_ 前缀
                    // 使用 snakeCase 统一转换（admin → admin）
                    const addonNameSnake = snakeCase(addonName);
                    tableName = `addon_${addonNameSnake}_${tableName}`;
                }

                processedCount++;

                const tableDefinition = await Bun.file(file).json();
                const existsTable = await tableExists(sql!, tableName);

                if (existsTable) {
                    await modifyTable(sql!, tableName, tableDefinition, globalCount);
                } else {
                    await createTable(sql!, tableName, tableDefinition);
                    globalCount.createdTables++;
                }
                globalCount.processedTables++;

                // 记录处理过的表名（用于清理缓存）
                processedTables.push(tableName);
            }
        }

        perfTracker.finishPhase('同步处理');

        // 清理 Redis 缓存（如果有表被处理）
        if (processedTables.length > 0) {
            perfTracker.markPhase('清理缓存');
            Logger.info(`🧹 清理 ${processedTables.length} 个表的字段缓存...`);

            let clearedCount = 0;
            for (const tableName of processedTables) {
                const cacheKey = `table:columns:${tableName}`;
                try {
                    await RedisHelper.del(cacheKey);
                    clearedCount++;
                } catch (error: any) {
                    Logger.warn(`清理表 ${tableName} 的缓存失败:`, error.message);
                }
            }

            Logger.info(`✓ 已清理 ${clearedCount} 个表的字段缓存`);
            perfTracker.finishPhase('清理缓存');
        }

        // 返回统计信息
        return {
            processedTables: globalCount.processedTables,
            createdTables: globalCount.createdTables,
            modifiedTables: globalCount.modifiedTables,
            addFields: globalCount.addFields,
            nameChanges: globalCount.nameChanges,
            typeChanges: globalCount.typeChanges,
            minChanges: globalCount.minChanges,
            maxChanges: globalCount.maxChanges,
            defaultChanges: globalCount.defaultChanges,
            indexCreate: globalCount.indexCreate,
            indexDrop: globalCount.indexDrop
        };
    } catch (error: any) {
        Logger.error(`数据库同步失败`, error);
        process.exit(1);
    } finally {
        if (sql) {
            try {
                await Database.disconnectSql();
            } catch (error: any) {
                Logger.warn('关闭数据库连接时出错:', error.message);
            }
        }

        try {
            await Database.disconnectRedis();
        } catch (error: any) {
            Logger.warn('关闭 Redis 连接时出错:', error.message);
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
