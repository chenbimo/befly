/**
 * syncDb 表创建模块
 *
 * 包含：
 * - 创建表（包含系统字段和业务字段）
 * - 添加 PostgreSQL 注释
 * - 创建表索引
 *
 * 注意：此模块从 table.ts 中提取，用于解除循环依赖
 */
import { snakeCase } from 'es-toolkit/string';
import { Logger } from '../util.js';
import { IS_MYSQL, IS_PG, MYSQL_TABLE_CONFIG } from './constants.js';
import { quoteIdentifier } from './helpers.js';
import { buildSystemColumnDefs, buildBusinessColumnDefs, buildIndexSQL } from './ddl.js';

import type { SQL } from 'bun';
import type { FieldDefinition } from 'befly/types/common';

// 是否为计划模式（从环境变量读取）
const IS_PLAN = process.argv.includes('--plan');

/**
 * 为 PostgreSQL 表添加列注释
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @param fields - 字段定义对象
 */
async function addPostgresComments(sql: SQL, tableName: string, fields: Record<string, FieldDefinition>): Promise<void> {
    // 系统字段注释
    const systemComments = [
        ['id', '主键ID'],
        ['created_at', '创建时间'],
        ['updated_at', '更新时间'],
        ['deleted_at', '删除时间'],
        ['state', '状态字段']
    ];

    for (const [name, comment] of systemComments) {
        const stmt = `COMMENT ON COLUMN "${tableName}"."${name}" IS '${comment}'`;
        if (IS_PLAN) {
            Logger.info(`[计划] ${stmt}`);
        } else {
            await sql.unsafe(stmt);
        }
    }

    // 业务字段注释
    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        // 转换字段名为下划线格式
        const dbFieldName = snakeCase(fieldKey);

        const { name: fieldName } = fieldDef;
        const stmt = `COMMENT ON COLUMN "${tableName}"."${dbFieldName}" IS '${fieldName}'`;
        if (IS_PLAN) {
            Logger.info(`[计划] ${stmt}`);
        } else {
            await sql.unsafe(stmt);
        }
    }
}

/**
 * 创建表的索引（并行执行以提升性能）
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @param fields - 字段定义对象
 * @param systemIndexFields - 系统字段索引列表
 */
async function createTableIndexes(sql: SQL, tableName: string, fields: Record<string, FieldDefinition>, systemIndexFields: string[]): Promise<void> {
    const indexTasks: Promise<void>[] = [];

    // 系统字段索引
    for (const sysField of systemIndexFields) {
        const stmt = buildIndexSQL(tableName, `idx_${sysField}`, sysField, 'create');
        if (IS_PLAN) {
            Logger.info(`[计划] ${stmt}`);
        } else {
            indexTasks.push(sql.unsafe(stmt));
        }
    }

    // 业务字段索引
    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        // 转换字段名为下划线格式
        const dbFieldName = snakeCase(fieldKey);

        if (fieldDef.index === true) {
            const stmt = buildIndexSQL(tableName, `idx_${dbFieldName}`, dbFieldName, 'create');
            if (IS_PLAN) {
                Logger.info(`[计划] ${stmt}`);
            } else {
                indexTasks.push(sql.unsafe(stmt));
            }
        }
    }

    // 并行执行所有索引创建
    if (indexTasks.length > 0) {
        await Promise.all(indexTasks);
    }
}

/**
 * 创建表（包含系统字段和业务字段）
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @param fields - 字段定义对象
 * @param systemIndexFields - 系统字段索引列表（可选，默认使用 ['created_at', 'updated_at', 'state']）
 */
export async function createTable(sql: SQL, tableName: string, fields: Record<string, FieldDefinition>, systemIndexFields: string[] = ['created_at', 'updated_at', 'state']): Promise<void> {
    // 构建列定义
    const colDefs = [...buildSystemColumnDefs(), ...buildBusinessColumnDefs(fields)];

    // 生成 CREATE TABLE 语句
    const cols = colDefs.join(',\n            ');
    const tableQuoted = quoteIdentifier(tableName);
    const { ENGINE, CHARSET, COLLATE } = MYSQL_TABLE_CONFIG;
    const createSQL = IS_MYSQL
        ? `CREATE TABLE ${tableQuoted} (
            ${cols}
        ) ENGINE=${ENGINE} DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATE}`
        : `CREATE TABLE ${tableQuoted} (
            ${cols}
        )`;

    if (IS_PLAN) {
        Logger.info(`[计划] ${createSQL.replace(/\n+/g, ' ')}`);
    } else {
        await sql.unsafe(createSQL);
    }

    // PostgreSQL: 添加列注释
    if (IS_PG && !IS_PLAN) {
        await addPostgresComments(sql, tableName, fields);
    } else if (IS_PG && IS_PLAN) {
        // 计划模式也要输出注释语句
        await addPostgresComments(sql, tableName, fields);
    }

    // 创建索引
    await createTableIndexes(sql, tableName, fields, systemIndexFields);
}
