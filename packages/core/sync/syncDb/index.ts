/**
 * syncDb 主入口文件
 *
 * 功能：
 * - 协调所有模块，执行数据库表结构同步
 * - 处理核心表、项目表、addon 表
 * - 提供统计信息和错误处理
 */

import { basename, resolve } from 'pathe';
import { existsSync } from 'node:fs';
import { snakeCase } from 'es-toolkit/string';
import { Database } from '../../lib/database.js';
import { RedisHelper } from '../../lib/redisHelper.js';
import checkTable from '../../checks/checkTable.js';
import { scanFiles, scanAddons, addonDirExists, getAddonDir } from 'befly-util';
import { Logger } from '../../lib/logger.js';
import { projectDir } from '../../paths.js';

// 导入模块化的功能
import { ensureDbVersion } from './version.js';
import { tableExists } from './schema.js';
import { modifyTable } from './table.js';
import { createTable } from './tableCreate.js';
import { applyFieldDefaults } from './helpers.js';
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
        const directories: Array<{ path: string; type: 'app' | 'addon'; addonName?: string; addonNameSnake?: string }> = [];

        // 1. 项目表（无前缀）- 如果 tables 目录存在
        const projectTablesDir = resolve(projectDir, 'tables');
        if (existsSync(projectTablesDir)) {
            directories.push({ path: projectTablesDir, type: 'app' });
        }

        // 添加所有 addon 的 tables 目录（addon_{name}_ 前缀）
        const addons = scanAddons();
        for (const addon of addons) {
            if (addonDirExists(addon, 'tables')) {
                directories.push({
                    path: getAddonDir(addon, 'tables'),
                    type: 'addon',
                    addonName: addon,
                    addonNameSnake: snakeCase(addon) // 提前转换，避免每个文件都转换
                });
            }
        }

        // 处理表文件
        for (const dirConfig of directories) {
            const { path: dir, type, addonName } = dirConfig;
            const dirType = type === 'addon' ? `组件${addonName}` : '项目';

            const files = await scanFiles(dir, '*.json');

            for (const { filePath: file, fileName } of files) {
                // 确定表名：
                // - addon 表：{addonName}_{表名}
                //   例如：admin addon 的 user.json → admin_user
                // - 项目表：{表名}
                //   例如：user.json → user
                let tableName = snakeCase(fileName);
                if (type === 'addon' && dirConfig.addonNameSnake) {
                    // addon 表，使用提前转换好的名称
                    tableName = `addon_${dirConfig.addonNameSnake}_${tableName}`;
                }

                const tableDefinitionModule = await import(file, { with: { type: 'json' } });
                const tableDefinition = tableDefinitionModule.default;

                // 为字段属性设置默认值
                for (const fieldDef of Object.values(tableDefinition)) {
                    applyFieldDefaults(fieldDef);
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
            Logger.debug(`🧹 清理 ${processedTables.length} 个表的字段缓存...`);

            const redisHelper = new RedisHelper();
            for (const tableName of processedTables) {
                const cacheKey = `table:columns:${tableName}`;
                try {
                    await redisHelper.del(cacheKey);
                } catch (error: any) {
                    Logger.warn(`清理表 ${tableName} 的缓存失败: ${error.message}`);
                }
            }

            Logger.debug(`✓ 已清理表字段缓存`);
        }
    } catch (error: any) {
        Logger.error(`数据库同步失败`, error);
        throw error;
    } finally {
        if (sql) {
            try {
                await Database.disconnectSql();
            } catch (error: any) {
                Logger.warn(`关闭数据库连接时出错: ${error.message}`);
            }
        }

        try {
            await Database.disconnectRedis();
        } catch (error: any) {
            Logger.warn(`关闭 Redis 连接时出错: ${error.message}`);
        }
    }
};
