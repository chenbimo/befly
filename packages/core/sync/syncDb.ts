/**
 * SyncDb 命令 - 同步数据库表结构
 *
 * 功能：
 * - 协调所有模块，执行数据库表结构同步
 * - 处理核心表、项目表、addon 表
 * - 提供统计信息和错误处理
 */

import { resolve } from 'pathe';
import { existsSync } from 'node:fs';
import { snakeCase } from 'es-toolkit/string';
import { Connect } from '../lib/connect.js';
import { RedisHelper } from '../lib/redisHelper.js';
import { checkTable } from '../checks/checkTable.js';
import { scanFiles } from '../utils/scanFiles.js';
import { scanAddons, addonDirExists, getAddonDir } from '../utils/addonHelper.js';
import { RedisKeys } from '../lib/redisKeys.js';
import { Logger } from '../lib/logger.js';
import { projectDir } from '../paths.js';

// 导入模块化的功能
import { ensureDbVersion } from './syncDb/version.js';
import { tableExists } from './syncDb/schema.js';
import { modifyTable } from './syncDb/table.js';
import { createTable } from './syncDb/tableCreate.js';
import { applyFieldDefaults } from './syncDb/helpers.js';
import { setDbType } from './syncDb/constants.js';
import { beflyConfig } from '../befly.config.js';
import type { SQL } from 'bun';
import type { SyncDbOptions } from '../types/index.js';

// 全局 SQL 客户端实例
let sql: SQL | null = null;

// 记录处理过的表名（用于清理缓存）
const processedTables: string[] = [];

/**
 * syncDbCommand - 数据库同步命令入口
 *
 * 流程：
 * 1. 验证表定义文件
 * 2. 建立数据库连接并检查版本
 * 3. 扫描表定义文件（核心表、项目表、addon表）
 * 4. 对比并应用表结构变更
 */
export async function syncDbCommand(options: SyncDbOptions = {}): Promise<void> {
    try {
        // 清空处理记录
        processedTables.length = 0;

        // 设置数据库类型（从配置获取）
        const dbType = beflyConfig.db?.type || 'mysql';
        setDbType(dbType);

        // 验证表定义文件
        await checkTable();

        // 建立数据库连接并检查版本
        sql = await Connect.connectSql();
        await ensureDbVersion(sql);

        // 初始化 Redis 连接（用于清理缓存）
        await Connect.connectRedis();

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
            const { path: dir, type } = dirConfig;

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

                // 如果指定了表名，则只同步该表
                if (options.table && options.table !== tableName) {
                    continue;
                }

                const tableDefinitionModule = await import(file, { with: { type: 'json' } });
                const tableDefinition = tableDefinitionModule.default;

                // 为字段属性设置默认值
                for (const fieldDef of Object.values(tableDefinition)) {
                    applyFieldDefaults(fieldDef);
                }

                const dbName = beflyConfig.db?.database || '';
                const existsTable = await tableExists(sql!, tableName, dbName);

                // 读取 force 参数
                const force = options.force || false;

                if (existsTable) {
                    await modifyTable(sql!, tableName, tableDefinition, force, dbName);
                } else {
                    await createTable(sql!, tableName, tableDefinition, ['created_at', 'updated_at', 'state'], dbName);
                }

                // 记录处理过的表名（用于清理缓存）
                processedTables.push(tableName);
            }
        }

        // 清理 Redis 缓存（如果有表被处理）
        if (processedTables.length > 0) {
            const redisHelper = new RedisHelper();
            const cacheKeys = processedTables.map((tableName) => RedisKeys.tableColumns(tableName));
            await redisHelper.delBatch(cacheKeys);
        }
    } catch (error: any) {
        Logger.error({ err: error }, '数据库同步失败');
        throw error;
    } finally {
        if (sql) {
            try {
                await Connect.disconnectSql();
            } catch (error: any) {
                Logger.warn(`关闭数据库连接时出错: ${error.message}`);
            }
        }

        try {
            await Connect.disconnectRedis();
        } catch (error: any) {
            Logger.warn(`关闭 Redis 连接时出错: ${error.message}`);
        }
    }
}
