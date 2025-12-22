/**
 * SyncTable 命令 - 同步数据库表结构
 *
 * 功能：
 * - 协调所有模块，执行数据库表结构同步
 * - 处理核心表、项目表、addon 表
 * - 提供统计信息和错误处理
 */

import type { BeflyContext } from "../types/befly.js";

import { snakeCase } from "es-toolkit/string";

import { CacheKeys } from "../lib/cacheKeys.js";
import { Logger } from "../lib/logger.js";
import { setDbType } from "./syncTable/constants.js";
import { applyFieldDefaults } from "./syncTable/helpers.js";
import { tableExists } from "./syncTable/schema.js";
import { modifyTable } from "./syncTable/table.js";
import { createTable } from "./syncTable/tableCreate.js";
// 导入模块化的功能
import { ensureDbVersion } from "./syncTable/version.js";

type SyncTableSource = "app" | "addon" | "core";

export type SyncTableInputItem = {
    source: SyncTableSource;
    type: "table";
    fileName: string;
    addonName?: string;
    tables: Record<string, any>;
};

// 记录处理过的表名（用于清理缓存）
const processedTables: string[] = [];

/**
 * syncTable - 数据库同步命令入口
 *
 * 流程：
 * 1. 建立数据库连接并检查版本
 * 2. 消费传入的表定义数据（来自 scanSources 的 tables）
 * 3. 对比并应用表结构变更
 */
export async function syncTable(ctx: BeflyContext, tables: SyncTableInputItem[]): Promise<void> {
    try {
        // 清空处理记录
        processedTables.length = 0;

        if (!Array.isArray(tables)) {
            throw new Error("syncTable(items) 参数必须是数组");
        }

        if (!ctx) {
            throw new Error("syncTable(ctx, tables) 缺少 ctx");
        }
        if (!ctx.db) {
            throw new Error("syncTable(ctx, tables) 缺少 ctx.db");
        }
        if (!ctx.redis) {
            throw new Error("syncTable(ctx, tables) 缺少 ctx.redis");
        }
        if (!ctx.config) {
            throw new Error("syncTable(ctx, tables) 缺少 ctx.config");
        }

        // 设置数据库类型（从 ctx.config 获取）
        const dbType = ctx.config.db?.type || "mysql";
        setDbType(dbType);

        // 检查数据库版本（复用 ctx.db 的现有连接/事务）
        await ensureDbVersion(ctx.db);

        // 处理传入的 tables 数据（来自 scanSources）
        for (const item of tables) {
            if (!item || item.type !== "table") {
                continue;
            }

            if (item.source !== "app" && item.source !== "addon") {
                Logger.warn(`syncTable 跳过未知来源表定义: source=${String(item.source)} fileName=${String(item.fileName)}`);
                continue;
            }

            // 确定表名：
            // - addon 表：addon_{addonName}_{表名}
            // - 项目表：{表名}
            let tableName = snakeCase(item.fileName);
            if (item.source === "addon") {
                if (!item.addonName || String(item.addonName).trim() === "") {
                    throw new Error(`syncTable addon 表缺少 addonName: fileName=${String(item.fileName)}`);
                }
                tableName = `addon_${snakeCase(item.addonName)}_${tableName}`;
            }

            const tableDefinition = item.tables;
            if (!tableDefinition || typeof tableDefinition !== "object") {
                throw new Error(`syncTable 表定义无效: table=${tableName}`);
            }

            // 为字段属性设置默认值
            for (const fieldDef of Object.values(tableDefinition)) {
                applyFieldDefaults(fieldDef);
            }

            const dbName = ctx.config.db?.database || "";
            const existsTable = await tableExists(ctx.db, tableName, dbName);

            if (existsTable) {
                await modifyTable(ctx.db, tableName, tableDefinition as any, dbName);
            } else {
                await createTable(ctx.db, tableName, tableDefinition as any, ["created_at", "updated_at", "state"], dbName);
            }

            // 记录处理过的表名（用于清理缓存）
            processedTables.push(tableName);
        }

        // 清理 Redis 缓存（如果有表被处理）
        if (processedTables.length > 0) {
            const cacheKeys = processedTables.map((tableName) => CacheKeys.tableColumns(tableName));
            await ctx.redis.delBatch(cacheKeys);
        }
    } catch (error: any) {
        Logger.error({ err: error }, "数据库同步失败");
        throw error;
    }
}
