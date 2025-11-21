/**
 * syncDb 表结构查询模块
 *
 * 包含：
 * - 判断表是否存在
 * - 获取表的列信息
 * - 获取表的索引信息
 */

import { IS_MYSQL, IS_PG, IS_SQLITE } from './constants.js';
import type { ColumnInfo, IndexInfo } from '../../types.js';
import type { SQL } from 'bun';

/**
 * 判断表是否存在（返回布尔值）
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @returns 表是否存在
 */
export async function tableExists(sql: SQL, tableName: string): Promise<boolean> {
    if (!sql) throw new Error('SQL 客户端未初始化');

    try {
        if (IS_MYSQL) {
            const res = await sql`SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ${process.env.DB_NAME} AND TABLE_NAME = ${tableName}`;
            return (res[0]?.count || 0) > 0;
        }

        if (IS_PG) {
            const res = await sql`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName}`;
            return (res[0]?.count || 0) > 0;
        }

        if (IS_SQLITE) {
            const res = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name = ${tableName}`;
            return res.length > 0;
        }

        return false;
    } catch (error: any) {
        throw new Error(`查询表是否存在失败 [${tableName}]: ${error.message}`);
    }
}

/**
 * 获取表的现有列信息（按方言）
 *
 * 查询数据库元数据，获取表的所有列信息，包括：
 * - 列名
 * - 数据类型
 * - 字符最大长度
 * - 是否可为空
 * - 默认值
 * - 列注释（MySQL/PG）
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @returns 列信息对象，键为列名，值为列详情
 */
export async function getTableColumns(sql: SQL, tableName: string): Promise<{ [key: string]: ColumnInfo }> {
    const columns: { [key: string]: ColumnInfo } = {};

    try {
        if (IS_MYSQL) {
            const result = await sql`
                SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, COLUMN_TYPE
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ${process.env.DB_NAME} AND TABLE_NAME = ${tableName}
                ORDER BY ORDINAL_POSITION
            `;
            for (const row of result) {
                // MySQL 的 COLUMN_DEFAULT 已经是解析后的实际值，无需处理：
                // - 空字符串 DEFAULT '': 返回 '' (空字符串)
                // - 字符串 DEFAULT 'admin': 返回 admin (无引号)
                // - 单引号 DEFAULT '''': 返回 ' (单引号字符)
                // - 数字 DEFAULT 0: 返回 0
                // - NULL: 返回 null
                const defaultValue = row.COLUMN_DEFAULT;

                columns[row.COLUMN_NAME] = {
                    type: row.DATA_TYPE,
                    columnType: row.COLUMN_TYPE,
                    max: row.CHARACTER_MAXIMUM_LENGTH,
                    nullable: row.IS_NULLABLE === 'YES',
                    defaultValue: defaultValue,
                    comment: row.COLUMN_COMMENT
                };
            }
        } else if (IS_PG) {
            const result = await sql`
                SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = ${tableName}
                ORDER BY ordinal_position
            `;
            // 获取列注释
            const comments = await sql`
                SELECT a.attname AS column_name, col_description(c.oid, a.attnum) AS column_comment
                FROM pg_class c
                JOIN pg_attribute a ON a.attrelid = c.oid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relname = ${tableName} AND a.attnum > 0
            `;
            const commentMap: { [key: string]: string } = {};
            for (const r of comments) commentMap[r.column_name] = r.column_comment;

            for (const row of result) {
                columns[row.column_name] = {
                    type: row.data_type,
                    columnType: row.data_type,
                    max: row.character_maximum_length,
                    nullable: String(row.is_nullable).toUpperCase() === 'YES',
                    defaultValue: row.column_default,
                    comment: commentMap[row.column_name] ?? null
                };
            }
        } else if (IS_SQLITE) {
            const result = await sql.unsafe(`PRAGMA table_info(${tableName})`);
            for (const row of result) {
                let baseType = String(row.type || '').toUpperCase();
                let max = null;
                const m = /^(\w+)\s*\((\d+)\)/.exec(baseType);
                if (m) {
                    baseType = m[1];
                    max = Number(m[2]);
                }
                columns[row.name] = {
                    type: baseType.toLowerCase(),
                    columnType: baseType.toLowerCase(),
                    max: max,
                    nullable: row.notnull === 0,
                    defaultValue: row.dflt_value,
                    comment: null
                };
            }
        }

        return columns;
    } catch (error: any) {
        throw new Error(`获取表列信息失败 [${tableName}]: ${error.message}`);
    }
}

/**
 * 获取表的现有索引信息（单列索引）
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @returns 索引信息对象，键为索引名，值为列名数组
 */
export async function getTableIndexes(sql: SQL, tableName: string): Promise<IndexInfo> {
    const indexes: IndexInfo = {};

    try {
        if (IS_MYSQL) {
            const result = await sql`
                SELECT INDEX_NAME, COLUMN_NAME
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = ${process.env.DB_NAME}
                    AND TABLE_NAME = ${tableName}
                    AND INDEX_NAME != 'PRIMARY'
                ORDER BY INDEX_NAME
            `;
            for (const row of result) {
                if (!indexes[row.INDEX_NAME]) indexes[row.INDEX_NAME] = [];
                indexes[row.INDEX_NAME].push(row.COLUMN_NAME);
            }
        } else if (IS_PG) {
            const result = await sql`
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = ${tableName}
            `;
            for (const row of result) {
                const m = /\(([^)]+)\)/.exec(row.indexdef);
                if (m) {
                    const col = m[1].replace(/\"/g, '').replace(/"/g, '').trim();
                    indexes[row.indexname] = [col];
                }
            }
        } else if (IS_SQLITE) {
            const list = await sql.unsafe(`PRAGMA index_list(${tableName})`);
            for (const idx of list) {
                const info = await sql.unsafe(`PRAGMA index_info(${idx.name})`);
                const cols = info.map((r) => r.name);
                if (cols.length === 1) indexes[idx.name] = cols;
            }
        }

        return indexes;
    } catch (error: any) {
        throw new Error(`获取表索引信息失败 [${tableName}]: ${error.message}`);
    }
}
