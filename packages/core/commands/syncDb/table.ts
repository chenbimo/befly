/**
 * syncDb 表操作模块
 *
 * 包含：
 * - 修改表结构
 * - 对比字段变化
 * - 应用变更计划
 */

import { toSnakeCase } from '../../utils/util.js';
import { parseRule } from '../../utils/table.js';
import { Logger } from '../../utils/logger.js';
import { IS_MYSQL, IS_PG, IS_SQLITE, SYSTEM_INDEX_FIELDS, CHANGE_TYPE_LABELS, typeMapping } from './constants.js';
import { quoteIdentifier, logFieldChange, resolveDefaultValue, generateDefaultSql, isStringOrArrayType, getSqlType } from './helpers.js';
import { buildIndexSQL, generateDDLClause, isPgCompatibleTypeChange } from './ddl.js';
import { getTableColumns, getTableIndexes, type ColumnInfo } from './schema.js';
import { compareFieldDefinition, applyTablePlan } from './apply.js';
import { createTable } from './tableCreate.js';
import type { TablePlan } from './types.js';
import type { SQL } from 'bun';

// 是否为计划模式（从环境变量读取）
const IS_PLAN = process.argv.includes('--plan');

// 导出 createTable 供其他模块使用
export { createTable };

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
        // 转换字段名为下划线格式（用于与数据库字段对比）
        const dbFieldName = toSnakeCase(fieldKey);

        if (existingColumns[dbFieldName]) {
            const comparison = compareFieldDefinition(existingColumns[dbFieldName], fieldRule, dbFieldName);
            if (comparison.length > 0) {
                for (const c of comparison) {
                    // 使用统一的日志格式函数和常量标签
                    const changeLabel = CHANGE_TYPE_LABELS[c.type] || '未知';
                    logFieldChange(tableName, dbFieldName, c.type, c.current, c.expected, changeLabel);

                    // 全量计数：全局累加
                    if (c.type === 'datatype') globalCount.typeChanges++;
                    else if (c.type === 'length') globalCount.maxChanges++;
                    else if (c.type === 'default') globalCount.defaultChanges++;
                    else if (c.type === 'comment') globalCount.nameChanges++;
                }

                const parsed = parseRule(fieldRule);
                const { name: fieldName, type: fieldType, max: fieldMax, default: fieldDefault } = parsed;

                if (isStringOrArrayType(fieldType) && existingColumns[dbFieldName].length) {
                    if (existingColumns[dbFieldName].length! > fieldMax) {
                        Logger.warn(`[跳过危险变更] ${tableName}.${dbFieldName} 长度收缩 ${existingColumns[dbFieldName].length} -> ${fieldMax} 已被跳过（设置 SYNC_DISALLOW_SHRINK=0 可放开）`);
                    }
                }

                const hasTypeChange = comparison.some((c) => c.type === 'datatype');
                const hasLengthChange = comparison.some((c) => c.type === 'length');
                const onlyDefaultChanged = comparison.every((c) => c.type === 'default');
                const defaultChanged = comparison.some((c) => c.type === 'default');

                // 严格限制：除 string/array 互转外，禁止任何字段类型变更；一旦发现，立即终止同步
                if (hasTypeChange) {
                    const currentSqlType = String(existingColumns[dbFieldName].type || '').toLowerCase();
                    const newSqlType = String(typeMapping[fieldType] || '').toLowerCase();
                    const errorMsg = [`禁止字段类型变更: ${tableName}.${dbFieldName}`, `当前类型: ${currentSqlType}`, `目标类型: ${newSqlType}`, `说明: 仅允许 string<->array 互相切换，其他类型变更需要手动处理`].join('\n');
                    throw new Error(errorMsg);
                }

                // 默认值变化处理
                if (defaultChanged) {
                    // 使用公共函数处理默认值
                    const actualDefault = resolveDefaultValue(fieldDefault, fieldType);

                    // 生成 SQL DEFAULT 值（不包含前导空格，因为要用于 ALTER COLUMN）
                    let v: string | null = null;
                    if (actualDefault !== 'null') {
                        const defaultSql = generateDefaultSql(actualDefault, fieldType);
                        // 移除前导空格 ' DEFAULT ' -> 'DEFAULT '
                        v = defaultSql.trim().replace(/^DEFAULT\s+/, '');
                    }

                    if (v !== null && v !== '') {
                        if (IS_PG) {
                            defaultClauses.push(`ALTER COLUMN "${dbFieldName}" SET DEFAULT ${v}`);
                        } else if (IS_MYSQL && onlyDefaultChanged) {
                            // MySQL 的 TEXT/BLOB 不允许 DEFAULT，跳过 text 类型
                            if (fieldType !== 'text') {
                                defaultClauses.push(`ALTER COLUMN \`${dbFieldName}\` SET DEFAULT ${v}`);
                            }
                        }
                    }
                }

                // 若不仅仅是默认值变化，继续生成修改子句
                if (!onlyDefaultChanged) {
                    let skipModify = false;
                    if (hasLengthChange && isStringOrArrayType(fieldType) && existingColumns[dbFieldName].length) {
                        const oldLen = existingColumns[dbFieldName].length!;
                        const isShrink = oldLen > fieldMax;
                        if (isShrink) skipModify = true;
                    }

                    if (hasTypeChange) {
                        if (IS_PG && isPgCompatibleTypeChange(existingColumns[dbFieldName].type, typeMapping[fieldType].toLowerCase())) {
                            Logger.info(`[PG兼容类型变更] ${tableName}.${dbFieldName} ${existingColumns[dbFieldName].type} -> ${typeMapping[fieldType].toLowerCase()} 允许执行`);
                        }
                    }

                    if (!skipModify) modifyClauses.push(generateDDLClause(fieldKey, fieldRule, false));
                }
                changed = true;
            }
        } else {
            const parsed = parseRule(fieldRule);
            const { name: fieldName, type: fieldType, max: fieldMax, default: fieldDefault } = parsed;
            const lenPart = isStringOrArrayType(fieldType) ? ` 长度:${parseInt(String(fieldMax))}` : '';
            Logger.info(`[新增字段] ${tableName}.${dbFieldName} 类型:${fieldType}${lenPart} 默认:${fieldDefault ?? 'NULL'}`);
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
        // 转换字段名为下划线格式
        const dbFieldName = toSnakeCase(fieldKey);

        const parsed = parseRule(fieldRule);
        const indexName = `idx_${dbFieldName}`;
        if (parsed.index === 1 && !existingIndexes[indexName]) {
            indexActions.push({ action: 'create', indexName, fieldName: dbFieldName });
            changed = true;
            globalCount.indexCreate++;
        } else if (!(parsed.index === 1) && existingIndexes[indexName] && existingIndexes[indexName].length === 1) {
            indexActions.push({ action: 'drop', indexName, fieldName: dbFieldName });
            changed = true;
            globalCount.indexDrop++;
        }
    }

    // PG 列注释处理
    const commentActions = [];
    if (IS_PG) {
        for (const [fieldKey, fieldRule] of Object.entries(fields)) {
            // 转换字段名为下划线格式
            const dbFieldName = toSnakeCase(fieldKey);

            if (existingColumns[dbFieldName]) {
                const parsed = parseRule(fieldRule);
                const { name: fieldName } = parsed;
                const curr = existingColumns[dbFieldName].comment || '';
                const want = fieldName && fieldName !== 'null' ? String(fieldName) : '';
                if (want !== curr) {
                    commentActions.push(`COMMENT ON COLUMN "${tableName}"."${dbFieldName}" IS ${want ? `'${want}'` : 'NULL'}`);
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
