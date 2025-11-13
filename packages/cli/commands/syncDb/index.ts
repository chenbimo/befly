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
import type { SQL } from 'bun';

// 全局 SQL 客户端实例
let sql: SQL | null = null;

// 记录处理过的表名（用于清理缓存）
const processedTables: string[] = [];

/**
 * 主同步函数
 *
 * 流程：
 * 1. 验证表定义文件
 * 2. 建立数据库连接并检查版本
 * 3. 扫描表定义文件（核心表、项目表、addon表）
 * 4. 对比并应用表结构变更
 */
export const SyncDb = async (): Promise<void> => {
    try {
        // 清空处理记录
        processedTables.length = 0;

        // 验证表定义文件
        await checkTable();

        // 建立数据库连接并检查版本
        sql = await Database.connectSql({ max: 1 });
        await ensureDbVersion(sql);

        // 初始化 Redis 连接（用于清理缓存）
        await Database.connectRedis();

        // 扫描表定义文件
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

        // 处理表文件
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

                const tableDefinitionModule = await import(file, { with: { type: 'json' } });
                const tableDefinition = tableDefinitionModule.default;

                // 为字段设置默认值：min=0, max=100
                for (const [fieldKey, fieldDef] of Object.entries(tableDefinition)) {
                    if (fieldDef.min === null || fieldDef.min === undefined) {
                        fieldDef.min = 0;
                    }
                    if (fieldDef.max === null || fieldDef.max === undefined) {
                        fieldDef.max = 100;
                    }
                }

                const existsTable = await tableExists(sql!, tableName);

                // 读取 force 参数
                const force = process.env.SYNC_FORCE === '1';

                if (existsTable) {
                    await modifyTable(sql!, tableName, tableDefinition, force);
                } else {
                    await createTable(sql!, tableName, tableDefinition);
                }

                // 记录处理过的表名（用于清理缓存）
                processedTables.push(tableName);
            }
        }

        // 清理 Redis 缓存（如果有表被处理）
        if (processedTables.length > 0) {
            Logger.info(`🧹 清理 ${processedTables.length} 个表的字段缓存...`);

            const redisHelper = new RedisHelper();
            for (const tableName of processedTables) {
                const cacheKey = `table:columns:${tableName}`;
                try {
                    await redisHelper.del(cacheKey);
                } catch (error: any) {
                    Logger.warn(`清理表 ${tableName} 的缓存失败:`, error.message);
                }
            }

            Logger.info(`✓ 已清理表字段缓存`);
        }
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
