/**
 * 数据库表结构同步脚本 - TypeScript 版本
 * 支持 MySQL 8.0+, PostgreSQL 17+, SQLite 3.50+
 */

import path from 'node:path';
import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { createSqlClient, toSnakeTableName, parseRule } from '../utils/index.js';
import { __dirtables, getProjectDir } from '../system.js';
import { checkTable } from '../checks/table.js';
import type { ParsedFieldRule } from '../types/common.js';

/**
 * 数据库类型
 */
type DbType = 'mysql' | 'postgresql' | 'sqlite';

/**
 * 列信息
 */
interface ColumnInfo {
    type: string;
    columnType?: string;
    length: number | null;
    nullable: boolean;
    defaultValue: string | null;
    comment: string | null;
}

/**
 * 索引信息
 */
interface IndexInfo {
    name: string;
    column: string;
}

/**
 * 统计信息
 */
interface SyncStats {
    processedTables: number;
    createdTables: number;
    modifiedTables: number;
    addFields: number;
    typeChanges: number;
    maxChanges: number;
    minChanges: number;
    defaultChanges: number;
    nameChanges: number;
    indexCreate: number;
    indexDrop: number;
}

// 全局变量
let sql: any = null;
const DB: DbType = (Env.DB_TYPE || 'mysql').toLowerCase() as DbType;
const IS_MYSQL = DB === 'mysql';
const IS_PG = DB === 'postgresql' || DB === 'postgres';
const IS_SQLITE = DB === 'sqlite';
const ARGV = Array.isArray(process.argv) ? process.argv : [];
const IS_PLAN = ARGV.includes('--plan');

// 字段类型映射
const typeMapping: Record<string, string> = {
    number: IS_SQLITE ? 'INTEGER' : 'BIGINT',
    string: IS_SQLITE ? 'TEXT' : IS_PG ? 'character varying' : 'VARCHAR',
    text: IS_MYSQL ? 'MEDIUMTEXT' : 'TEXT',
    array: IS_SQLITE ? 'TEXT' : IS_PG ? 'character varying' : 'VARCHAR'
};

// 全局统计
const globalCount: SyncStats = {
    processedTables: 0,
    createdTables: 0,
    modifiedTables: 0,
    addFields: 0,
    typeChanges: 0,
    maxChanges: 0,
    minChanges: 0,
    defaultChanges: 0,
    nameChanges: 0,
    indexCreate: 0,
    indexDrop: 0
};

/**
 * 数据库版本检查
 */
const ensureDbVersion = async (): Promise<void> => {
    if (!sql) throw new Error('SQL 客户端未初始化');

    if (IS_MYSQL) {
        const r = await sql`SELECT VERSION() AS version`;
        const version = r[0].version;
        const majorVersion = parseInt(String(version).split('.')[0], 10);
        if (!Number.isFinite(majorVersion) || majorVersion < 8) {
            throw new Error(`此脚本仅支持 MySQL 8.0+，当前版本: ${version}`);
        }
        Logger.info(`MySQL 版本: ${version}`);
        return;
    }

    if (IS_PG) {
        const r = await sql`SELECT version() AS version`;
        const versionText = r[0].version;
        Logger.info(`PostgreSQL 版本: ${versionText}`);
        const m = /PostgreSQL\s+(\d+)/i.exec(versionText);
        const major = m ? parseInt(m[1], 10) : NaN;
        if (!Number.isFinite(major) || major < 17) {
            throw new Error(`此脚本要求 PostgreSQL >= 17，当前: ${versionText}`);
        }
        return;
    }

    if (IS_SQLITE) {
        const r = await sql`SELECT sqlite_version() AS version`;
        const version = r[0].version;
        Logger.info(`SQLite 版本: ${version}`);
        const [maj, min, patch] = String(version)
            .split('.')
            .map((v) => parseInt(v, 10) || 0);
        const vnum = maj * 10000 + min * 100 + patch;
        if (!Number.isFinite(vnum) || vnum < 35000) {
            throw new Error(`此脚本要求 SQLite >= 3.50.0，当前: ${version}`);
        }
        return;
    }
};

/**
 * 判断表是否存在
 */
const tableExists = async (tableName: string): Promise<boolean> => {
    if (!sql) throw new Error('SQL 客户端未初始化');

    if (IS_MYSQL) {
        const res = await sql`
            SELECT COUNT(*) AS count
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ${Env.DB_NAME}
            AND TABLE_NAME = ${tableName}
        `;
        return (res[0]?.count || 0) > 0;
    }

    if (IS_PG) {
        const res = await sql`
            SELECT COUNT(*)::int AS count
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = ${tableName}
        `;
        return (res[0]?.count || 0) > 0;
    }

    if (IS_SQLITE) {
        const res = await sql`
            SELECT name
            FROM sqlite_master
            WHERE type='table'
            AND name = ${tableName}
        `;
        return res.length > 0;
    }

    return false;
};

/**
 * 获取表的现有列信息
 */
const getTableColumns = async (tableName: string): Promise<Record<string, ColumnInfo>> => {
    const columns: Record<string, ColumnInfo> = {};

    if (!sql) throw new Error('SQL 客户端未初始化');

    if (IS_MYSQL) {
        const result = await sql`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH,
                   IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, COLUMN_TYPE
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ${Env.DB_NAME}
            AND TABLE_NAME = ${tableName}
            ORDER BY ORDINAL_POSITION
        `;
        for (const row of result) {
            columns[row.COLUMN_NAME] = {
                type: row.DATA_TYPE,
                columnType: row.COLUMN_TYPE,
                length: row.CHARACTER_MAXIMUM_LENGTH,
                nullable: row.IS_NULLABLE === 'YES',
                defaultValue: row.COLUMN_DEFAULT,
                comment: row.COLUMN_COMMENT
            };
        }
    } else if (IS_PG) {
        const result = await sql`
            SELECT column_name, data_type, character_maximum_length,
                   is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = ${tableName}
            ORDER BY ordinal_position
        `;
        const comments = await sql`
            SELECT a.attname AS column_name,
                   col_description(c.oid, a.attnum) AS column_comment
            FROM pg_class c
            JOIN pg_attribute a ON a.attrelid = c.oid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r'
            AND n.nspname = 'public'
            AND c.relname = ${tableName}
            AND a.attnum > 0
        `;
        const commentMap: Record<string, string> = {};
        for (const r of comments) {
            commentMap[r.column_name] = r.column_comment;
        }
        for (const row of result) {
            columns[row.column_name] = {
                type: row.data_type,
                length: row.character_maximum_length,
                nullable: row.is_nullable === 'YES',
                defaultValue: row.column_default,
                comment: commentMap[row.column_name] || null
            };
        }
    } else if (IS_SQLITE) {
        const result = await sql`PRAGMA table_info(${tableName})`;
        for (const row of result) {
            columns[row.name] = {
                type: row.type,
                length: null,
                nullable: row.notnull === 0,
                defaultValue: row.dflt_value,
                comment: null
            };
        }
    }

    return columns;
};

/**
 * 获取表的索引信息
 */
const getTableIndexes = async (tableName: string): Promise<IndexInfo[]> => {
    const indexes: IndexInfo[] = [];

    if (!sql) throw new Error('SQL 客户端未初始化');

    if (IS_MYSQL) {
        const result = await sql`
            SELECT INDEX_NAME, COLUMN_NAME
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = ${Env.DB_NAME}
            AND TABLE_NAME = ${tableName}
            AND INDEX_NAME != 'PRIMARY'
            ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `;
        for (const row of result) {
            indexes.push({
                name: row.INDEX_NAME,
                column: row.COLUMN_NAME
            });
        }
    } else if (IS_PG) {
        const result = await sql`
            SELECT indexname AS name, indexdef AS definition
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename = ${tableName}
        `;
        for (const row of result) {
            const match = /\(([^)]+)\)/.exec(row.definition);
            if (match) {
                indexes.push({
                    name: row.name,
                    column: match[1]
                });
            }
        }
    } else if (IS_SQLITE) {
        const result = await sql`PRAGMA index_list(${tableName})`;
        for (const row of result) {
            const info = await sql`PRAGMA index_info(${row.name})`;
            if (info.length > 0) {
                indexes.push({
                    name: row.name,
                    column: info[0].name
                });
            }
        }
    }

    return indexes;
};

/**
 * 创建表
 */
const createTable = async (tableName: string, fields: Record<string, ParsedFieldRule>): Promise<void> => {
    const columns: string[] = [];

    // 添加系统字段
    if (IS_MYSQL) {
        columns.push('`id` BIGINT NOT NULL PRIMARY KEY');
        columns.push('`created_at` BIGINT NOT NULL DEFAULT 0');
        columns.push('`updated_at` BIGINT NOT NULL DEFAULT 0');
        columns.push('`deleted_at` BIGINT NOT NULL DEFAULT 0');
        columns.push('`state` TINYINT NOT NULL DEFAULT 1');
    } else if (IS_PG) {
        columns.push('"id" BIGINT NOT NULL PRIMARY KEY');
        columns.push('"created_at" BIGINT NOT NULL DEFAULT 0');
        columns.push('"updated_at" BIGINT NOT NULL DEFAULT 0');
        columns.push('"deleted_at" BIGINT NOT NULL DEFAULT 0');
        columns.push('"state" SMALLINT NOT NULL DEFAULT 1');
    } else if (IS_SQLITE) {
        columns.push('id INTEGER NOT NULL PRIMARY KEY');
        columns.push('created_at INTEGER NOT NULL DEFAULT 0');
        columns.push('updated_at INTEGER NOT NULL DEFAULT 0');
        columns.push('deleted_at INTEGER NOT NULL DEFAULT 0');
        columns.push('state INTEGER NOT NULL DEFAULT 1');
    }

    // 添加自定义字段
    for (const [fieldName, rule] of Object.entries(fields)) {
        const dbType = typeMapping[rule.type];
        const quote = IS_SQLITE ? '' : IS_PG ? '"' : '`';
        let columnDef = `${quote}${fieldName}${quote} ${dbType}`;

        // 添加长度限制
        if (rule.type === 'string' || rule.type === 'array') {
            if (rule.max && !IS_SQLITE) {
                columnDef += `(${rule.max})`;
            }
        }

        // 添加默认值（text类型除外）
        if (rule.type !== 'text' && rule.default !== 'null') {
            if (rule.type === 'number') {
                columnDef += ` DEFAULT ${rule.default}`;
            } else {
                columnDef += ` DEFAULT '${rule.default}'`;
            }
        }

        // 添加注释（MySQL）
        if (IS_MYSQL && rule.name) {
            columnDef += ` COMMENT '${rule.name}'`;
        }

        columns.push(columnDef);
    }

    const createSql = `CREATE TABLE ${IS_SQLITE ? '' : IS_PG ? '"' : '`'}${tableName}${IS_SQLITE ? '' : IS_PG ? '"' : '`'} (${columns.join(', ')})`;

    if (IS_PLAN) {
        Logger.info(`[计划] 创建表: ${tableName}`);
        Logger.info(`[SQL] ${createSql}`);
    } else {
        await sql.unsafe(createSql);
        Logger.info(`✓ 创建表: ${tableName}`);
    }

    globalCount.createdTables++;
};

/**
 * 主同步函数
 */
export async function SyncDb(): Promise<void> {
    try {
        Logger.info('========== 开始数据库表结构同步 ==========');
        Logger.info(`数据库类型: ${DB}`);
        Logger.info(`计划模式: ${IS_PLAN ? '是' : '否'}`);

        // 执行表定义检查
        Logger.info('\n步骤 1/4: 检查表定义文件...');
        const checkResult = await checkTable();
        if (!checkResult) {
            Logger.error('表定义检查失败，终止同步');
            process.exit(1);
        }

        // 初始化数据库连接
        Logger.info('\n步骤 2/4: 初始化数据库连接...');
        sql = await createSqlClient();
        await ensureDbVersion();

        // 收集所有表定义文件
        Logger.info('\n步骤 3/4: 收集表定义文件...');
        const tablesGlob = new Bun.Glob('*.json');
        const allTableFiles: string[] = [];

        for await (const file of tablesGlob.scan({
            cwd: __dirtables,
            absolute: true,
            onlyFiles: true
        })) {
            allTableFiles.push(file);
        }

        for await (const file of tablesGlob.scan({
            cwd: getProjectDir('tables'),
            absolute: true,
            onlyFiles: true
        })) {
            allTableFiles.push(file);
        }

        Logger.info(`找到 ${allTableFiles.length} 个表定义文件`);

        // 同步表结构
        Logger.info('\n步骤 4/4: 同步表结构...');
        for (const file of allTableFiles) {
            const fileName = path.basename(file, '.json');
            const tableName = toSnakeTableName(fileName);

            try {
                globalCount.processedTables++;

                // 读取表定义
                const tableDefJson = await Bun.file(file).json();
                const fields: Record<string, ParsedFieldRule> = {};

                for (const [fieldName, rule] of Object.entries(tableDefJson)) {
                    if (typeof rule === 'string') {
                        fields[fieldName] = parseRule(rule);
                    }
                }

                // 检查表是否存在
                const exists = await tableExists(tableName);

                if (!exists) {
                    // 创建新表
                    await createTable(tableName, fields);
                } else {
                    // 表已存在，检查变更（简化版）
                    Logger.info(`✓ 表已存在: ${tableName}`);
                }
            } catch (error: any) {
                Logger.error(`处理表 ${tableName} 时出错: ${error.message}`);
            }
        }

        // 输出统计信息
        Logger.info('\n========== 同步完成 ==========');
        Logger.info(`处理表数: ${globalCount.processedTables}`);
        Logger.info(`创建表数: ${globalCount.createdTables}`);
        Logger.info(`修改表数: ${globalCount.modifiedTables}`);
        Logger.info(`新增字段: ${globalCount.addFields}`);
        Logger.info(`类型变更: ${globalCount.typeChanges}`);
        Logger.info(`长度变更: ${globalCount.maxChanges}`);
        Logger.info(`索引创建: ${globalCount.indexCreate}`);
        Logger.info(`索引删除: ${globalCount.indexDrop}`);
    } catch (error: any) {
        Logger.error('数据库同步失败:');
        Logger.error(`错误信息: ${error.message}`);
        if (error.stack) {
            Logger.error(`堆栈信息: ${error.stack}`);
        }
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
}

/**
 * 如果直接运行此脚本
 */
if (import.meta.main) {
    SyncDb().catch((error: Error) => {
        console.error('❌ 数据库同步失败:', error);
        process.exit(1);
    });
}
