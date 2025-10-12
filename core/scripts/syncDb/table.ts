/**
 * syncDb 表操作模块
 *
 * 包含：
 * - 创建表
 * - 创建索引
 * - 添加 PostgreSQL 注释
 * - 修改表结构
 */

import type { SQL } from 'bun';
import { Logger } from '../../utils/logger.js';
import { parseRule } from '../../utils/tableHelper.js';
import { isType } from '../../utils/typeHelper.js';
import { IS_MYSQL, IS_PG, IS_SQLITE, SYSTEM_INDEX_FIELDS, typeMapping } from './constants.js';
import { quoteIdentifier, logFieldChange } from './helpers.js';
import { buildSystemColumnDefs, buildBusinessColumnDefs, buildIndexSQL, generateDDLClause, isPgCompatibleTypeChange } from './ddl.js';
import { getTableColumns, getTableIndexes, type ColumnInfo } from './schema.js';
import { compareFieldDefinition, applyTablePlan, type TablePlan } from './apply.js';

// 是否为计划模式（从环境变量读取）
const IS_PLAN = process.argv.includes('--plan');

/**
 * 为 PostgreSQL 表添加列注释
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @param fields - 字段定义对象
 */
export async function addPostgresComments(sql: SQL, tableName: string, fields: Record<string, string>): Promise<void> {
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
    for (const [fieldKey, fieldRule] of Object.entries(fields)) {
        const parsed = parseRule(fieldRule);
        const { name: fieldName } = parsed;
        const stmt = `COMMENT ON COLUMN "${tableName}"."${fieldKey}" IS '${fieldName}'`;
        if (IS_PLAN) {
            Logger.info(`[计划] ${stmt}`);
        } else {
            await sql.unsafe(stmt);
        }
    }
}

/**
 * 创建表的索引
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @param fields - 字段定义对象
 */
export async function createTableIndexes(sql: SQL, tableName: string, fields: Record<string, string>): Promise<void> {
    // 系统字段索引
    for (const sysField of SYSTEM_INDEX_FIELDS) {
        const stmt = buildIndexSQL(tableName, `idx_${sysField}`, sysField, 'create');
        if (IS_PLAN) {
            Logger.info(`[计划] ${stmt}`);
        } else {
            await sql.unsafe(stmt);
        }
    }

    // 业务字段索引
    for (const [fieldKey, fieldRule] of Object.entries(fields)) {
        const parsed = parseRule(fieldRule);
        if (parsed.index === 1) {
            const stmt = buildIndexSQL(tableName, `idx_${fieldKey}`, fieldKey, 'create');
            if (IS_PLAN) {
                Logger.info(`[计划] ${stmt}`);
            } else {
                await sql.unsafe(stmt);
            }
        }
    }
}

/**
 * 创建表（包含系统字段和业务字段）
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @param fields - 字段定义对象
 */
export async function createTable(sql: SQL, tableName: string, fields: Record<string, string>): Promise<void> {
    // 构建列定义
    const colDefs = [...buildSystemColumnDefs(), ...buildBusinessColumnDefs(fields)];

    // 生成 CREATE TABLE 语句
    const cols = colDefs.join(',\n            ');
    const tableQuoted = quoteIdentifier(tableName);
    const createSQL = IS_MYSQL ? `CREATE TABLE ${tableQuoted} (\n            ${cols}\n        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs` : `CREATE TABLE ${tableQuoted} (\n            ${cols}\n        )`;

    if (IS_PLAN) {
        Logger.info(`[计划] ${createSQL.replace(/\n+/g, ' ')}`);
    } else {
        await sql.unsafe(createSQL);
        Logger.info(`[新建表] ${tableName}`);
    }

    // PostgreSQL: 添加列注释
    if (IS_PG && !IS_PLAN) {
        await addPostgresComments(sql, tableName, fields);
    } else if (IS_PG && IS_PLAN) {
        // 计划模式也要输出注释语句
        await addPostgresComments(sql, tableName, fields);
    }

    // 创建索引
    await createTableIndexes(sql, tableName, fields);
}

/**
 * 同步表结构（对比和应用变更）
 *
 * 主要逻辑：
 * 1. 获取表的现有列和索引信息
 * 2. 对比每个字段的定义变化
 * 3. 生成 DDL 变更计划
 * 4. 处理索引的增删
 * 5. 应用变更计划
 *
 * 安全策略：
 * - 禁止字段类型变更（除 string<->array）
 * - 跳过危险的长度收缩
 * - 使用在线 DDL（MySQL/PG）
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @param fields - 字段定义对象
 * @param globalCount - 全局统计对象（用于计数）
 * @returns 表结构变更计划
 */
export async function modifyTable(sql: SQL, tableName: string, fields: Record<string, string>, globalCount: Record<string, number>): Promise<TablePlan> {
    const existingColumns = await getTableColumns(sql, tableName);
    const existingIndexes = await getTableIndexes(sql, tableName);
    let changed = false;

    const addClauses = [];
    const modifyClauses = [];
    const defaultClauses = [];
    const indexActions = [];

    for (const [fieldKey, fieldRule] of Object.entries(fields)) {
        if (existingColumns[fieldKey]) {
            const comparison = compareFieldDefinition(existingColumns[fieldKey], fieldRule, fieldKey);
            if (comparison.length > 0) {
                for (const c of comparison) {
                    // 使用统一的日志格式函数
                    const changeLabel = c.type === 'length' ? '长度' : c.type === 'datatype' ? '类型' : c.type === 'comment' ? '注释' : '默认值';
                    logFieldChange(tableName, fieldKey, c.type, c.current, c.new, changeLabel);

                    // 全量计数：全局累加
                    if (c.type === 'datatype') globalCount.typeChanges++;
                    else if (c.type === 'length') globalCount.maxChanges++;
                    else if (c.type === 'default') globalCount.defaultChanges++;
                    else if (c.type === 'comment') globalCount.nameChanges++;
                }

                const parsed = parseRule(fieldRule);
                const { name: fieldName, type: fieldType, max: fieldMax, default: fieldDefault } = parsed;

                if ((fieldType === 'string' || fieldType === 'array') && existingColumns[fieldKey].length) {
                    if (existingColumns[fieldKey].length! > fieldMax) {
                        Logger.warn(`[跳过危险变更] ${tableName}.${fieldKey} 长度收缩 ${existingColumns[fieldKey].length} -> ${fieldMax} 已被跳过（设置 SYNC_DISALLOW_SHRINK=0 可放开）`);
                    }
                }

                const hasTypeChange = comparison.some((c) => c.type === 'datatype');
                const hasLengthChange = comparison.some((c) => c.type === 'length');
                const onlyDefaultChanged = comparison.every((c) => c.type === 'default');
                const defaultChanged = comparison.some((c) => c.type === 'default');

                // 严格限制：除 string/array 互转外，禁止任何字段类型变更；一旦发现，立即终止同步
                if (hasTypeChange) {
                    const currentSqlType = String(existingColumns[fieldKey].type || '').toLowerCase();
                    const newSqlType = String(typeMapping[fieldType] || '').toLowerCase();
                    const errorMsg = [`禁止字段类型变更: ${tableName}.${fieldKey}`, `当前类型: ${currentSqlType}`, `目标类型: ${newSqlType}`, `说明: 仅允许 string<->array 互相切换，其他类型变更需要手动处理`].join('\n');
                    throw new Error(errorMsg);
                }

                // 默认值变化处理：
                if (defaultChanged) {
                    const v = fieldType === 'number' ? fieldDefault : `'${fieldDefault}'`;
                    if (IS_PG) {
                        defaultClauses.push(`ALTER COLUMN "${fieldKey}" SET DEFAULT ${v}`);
                    } else if (IS_MYSQL && onlyDefaultChanged) {
                        // MySQL 的 TEXT/BLOB 不允许 DEFAULT，跳过 text 类型
                        if (fieldType !== 'text') {
                            defaultClauses.push(`ALTER COLUMN \`${fieldKey}\` SET DEFAULT ${v}`);
                        }
                    }
                }

                // 若不仅仅是默认值变化，继续生成修改子句
                if (!onlyDefaultChanged) {
                    let skipModify = false;
                    if (hasLengthChange && (fieldType === 'string' || fieldType === 'array') && existingColumns[fieldKey].length) {
                        const oldLen = existingColumns[fieldKey].length!;
                        const isShrink = oldLen > fieldMax;
                        if (isShrink) skipModify = true;
                    }

                    if (hasTypeChange) {
                        if (IS_PG && isPgCompatibleTypeChange(existingColumns[fieldKey].type, typeMapping[fieldType].toLowerCase())) {
                            Logger.info(`[PG兼容类型变更] ${tableName}.${fieldKey} ${existingColumns[fieldKey].type} -> ${typeMapping[fieldType].toLowerCase()} 允许执行`);
                        }
                    }

                    if (!skipModify) modifyClauses.push(generateDDLClause(fieldKey, fieldRule, false));
                }
                changed = true;
            }
        } else {
            const parsed = parseRule(fieldRule);
            const { name: fieldName, type: fieldType, max: fieldMax, default: fieldDefault } = parsed;
            const lenPart = fieldType === 'string' || fieldType === 'array' ? ` 长度:${parseInt(String(fieldMax))}` : '';
            Logger.info(`[新增字段] ${tableName}.${fieldKey} 类型:${fieldType}${lenPart} 默认:${fieldDefault ?? 'NULL'}`);
            addClauses.push(generateDDLClause(fieldKey, fieldRule, true));
            changed = true;
            globalCount.addFields++;
        }
    }

    // 检查系统字段索引
    for (const sysField of ['created_at', 'updated_at', 'state']) {
        const idxName = `idx_${sysField}`;
        if (!existingIndexes[idxName]) {
            indexActions.push({ action: 'create', indexName: idxName, fieldName: sysField });
            changed = true;
            globalCount.indexCreate++;
        }
    }

    // 检查业务字段索引
    for (const [fieldKey, fieldRule] of Object.entries(fields)) {
        const parsed = parseRule(fieldRule);
        const indexName = `idx_${fieldKey}`;
        if (parsed.index === 1 && !existingIndexes[indexName]) {
            indexActions.push({ action: 'create', indexName, fieldName: fieldKey });
            changed = true;
            globalCount.indexCreate++;
        } else if (!(parsed.index === 1) && existingIndexes[indexName] && existingIndexes[indexName].length === 1) {
            indexActions.push({ action: 'drop', indexName, fieldName: fieldKey });
            changed = true;
            globalCount.indexDrop++;
        }
    }

    // PG 列注释处理
    const commentActions = [];
    if (IS_PG) {
        for (const [fieldKey, fieldRule] of Object.entries(fields)) {
            if (existingColumns[fieldKey]) {
                const parsed = parseRule(fieldRule);
                const { name: fieldName } = parsed;
                const curr = existingColumns[fieldKey].comment || '';
                const want = fieldName && fieldName !== 'null' ? String(fieldName) : '';
                if (want !== curr) {
                    commentActions.push(`COMMENT ON COLUMN "${tableName}"."${fieldKey}" IS ${want ? `'${want}'` : 'NULL'}`);
                    changed = true;
                }
            }
        }
    }

    // 仅当存在实际动作时才认为有变更（避免仅日志的收缩跳过被计为修改）
    changed = addClauses.length > 0 || modifyClauses.length > 0 || defaultClauses.length > 0 || indexActions.length > 0 || commentActions.length > 0;

    const plan = { changed, addClauses, modifyClauses, defaultClauses, indexActions, commentActions };

    // 将计划应用（包含 --plan 情况下仅输出）
    if (plan.changed) {
        await applyTablePlan(sql, tableName, fields, plan, globalCount);
    }

    return plan;
}
