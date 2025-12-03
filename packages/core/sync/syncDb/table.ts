/**
 * syncDb 表操作模块
 *
 * 包含：
 * - 修改表结构
 * - 对比字段变化
 * - 应用变更计划
 */

import { snakeCase } from 'es-toolkit/string';
import { Logger } from '../../lib/logger.js';
import { isMySQL, isPG, CHANGE_TYPE_LABELS, getTypeMapping, SYSTEM_INDEX_FIELDS } from './constants.js';
import { logFieldChange, resolveDefaultValue, generateDefaultSql, isStringOrArrayType } from './helpers.js';
import { generateDDLClause, getSystemColumnDef, isCompatibleTypeChange } from './ddl.js';
import { getTableColumns, getTableIndexes } from './schema.js';
import { compareFieldDefinition, applyTablePlan } from './apply.js';
import type { TablePlan } from '../../types/sync.js';
import type { SQL } from 'bun';
import type { FieldDefinition } from 'befly-shared/types';

/**
 * 同步表结构（对比和应用变更）
 *
 * 主要逻辑：
 * 1. 获取表的现有列和索引信息
 * 2. 对比每个字段的定义变化
 * 3. 生成变更计划（添加/修改/删除列，添加/删除索引）
 * 4. 执行变更 SQL
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @param fields - 字段定义
 * @param force - 是否强制同步（删除多余字段）
 * @param dbName - 数据库名称
 */
export async function modifyTable(sql: SQL, tableName: string, fields: Record<string, FieldDefinition>, force: boolean = false, dbName?: string): Promise<TablePlan> {
    const existingColumns = await getTableColumns(sql, tableName, dbName || '');
    const existingIndexes = await getTableIndexes(sql, tableName, dbName || '');
    let changed = false;

    const addClauses: string[] = [];
    const modifyClauses: string[] = [];
    const defaultClauses: string[] = [];
    const indexActions: Array<{ action: 'create' | 'drop'; indexName: string; fieldName: string }> = [];

    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        // 转换字段名为下划线格式
        const dbFieldName = snakeCase(fieldKey);

        if (existingColumns[dbFieldName]) {
            const comparison = compareFieldDefinition(existingColumns[dbFieldName], fieldDef);
            if (comparison.length > 0) {
                for (const c of comparison) {
                    // 使用统一的日志格式函数和常量标签
                    const changeLabel = CHANGE_TYPE_LABELS[c.type as keyof typeof CHANGE_TYPE_LABELS] || '未知';
                    logFieldChange(tableName, dbFieldName, c.type, c.current, c.expected, changeLabel);
                }

                if (isStringOrArrayType(fieldDef.type) && existingColumns[dbFieldName].max && fieldDef.max !== null) {
                    if (existingColumns[dbFieldName].max! > fieldDef.max) {
                        if (force) {
                            Logger.warn(`[强制执行] ${tableName}.${dbFieldName} 长度收缩 ${existingColumns[dbFieldName].max} -> ${fieldDef.max}`);
                        } else {
                            Logger.warn(`[跳过危险变更] ${tableName}.${dbFieldName} 长度收缩 ${existingColumns[dbFieldName].max} -> ${fieldDef.max} 已被跳过（使用 --force 强制执行）`);
                        }
                    }
                }

                const hasTypeChange = comparison.some((c) => c.type === 'datatype');
                const hasLengthChange = comparison.some((c) => c.type === 'length');
                const onlyDefaultChanged = comparison.every((c) => c.type === 'default');
                const defaultChanged = comparison.some((c) => c.type === 'default');

                // 类型变更检查：只允许兼容的宽化型变更（如 INT -> BIGINT）
                if (hasTypeChange) {
                    const typeChange = comparison.find((c) => c.type === 'datatype');
                    const currentType = String(typeChange?.current || '').toLowerCase();
                    const typeMapping = getTypeMapping();
                    const expectedType = typeMapping[fieldDef.type]?.toLowerCase() || '';

                    if (!isCompatibleTypeChange(currentType, expectedType)) {
                        const errorMsg = [`禁止字段类型变更: ${tableName}.${dbFieldName}`, `当前类型: ${typeChange?.current}`, `目标类型: ${typeChange?.expected}`, `说明: 仅允许宽化型变更（如 INT->BIGINT, VARCHAR->TEXT），其他类型变更需要手动处理`].join('\n');
                        throw new Error(errorMsg);
                    }
                    Logger.debug(`[兼容类型变更] ${tableName}.${dbFieldName} ${currentType} -> ${expectedType}`);
                }

                // 默认值变化处理
                if (defaultChanged) {
                    // 使用公共函数处理默认值
                    const actualDefault = resolveDefaultValue(fieldDef.default, fieldDef.type);

                    // 生成 SQL DEFAULT 值（不包含前导空格，因为要用于 ALTER COLUMN）
                    let v: string | null = null;
                    if (actualDefault !== 'null') {
                        const defaultSql = generateDefaultSql(actualDefault, fieldDef.type);
                        // 移除前导空格 ' DEFAULT ' -> 'DEFAULT '
                        v = defaultSql.trim().replace(/^DEFAULT\s+/, '');
                    }

                    if (v !== null && v !== '') {
                        if (isPG()) {
                            defaultClauses.push(`ALTER COLUMN "${dbFieldName}" SET DEFAULT ${v}`);
                        } else if (isMySQL() && onlyDefaultChanged) {
                            // MySQL 的 TEXT/BLOB 不允许 DEFAULT，跳过 text 类型
                            if (fieldDef.type !== 'text') {
                                defaultClauses.push(`ALTER COLUMN \`${dbFieldName}\` SET DEFAULT ${v}`);
                            }
                        }
                    }
                }

                // 若不仅仅是默认值变化，继续生成修改子句
                if (!onlyDefaultChanged) {
                    let skipModify = false;
                    if (hasLengthChange && isStringOrArrayType(fieldDef.type) && existingColumns[dbFieldName].max && fieldDef.max !== null) {
                        const isShrink = existingColumns[dbFieldName].max! > fieldDef.max;
                        if (isShrink && !force) skipModify = true;
                    }

                    if (!skipModify) modifyClauses.push(generateDDLClause(fieldKey, fieldDef, false));
                }
                changed = true;
            }
        } else {
            const lenPart = isStringOrArrayType(fieldDef.type) ? ` 长度:${parseInt(String(fieldDef.max))}` : '';
            // Logger.debug(`  + 新增字段 ${dbFieldName} (${fieldDef.type}${lenPart})`);
            addClauses.push(generateDDLClause(fieldKey, fieldDef, true));
            changed = true;
        }
    }

    // 检查并添加缺失的系统字段（created_at, updated_at, deleted_at, state）
    // 注意：id 是主键，不会缺失；这里只处理可能缺失的其他系统字段
    const systemFieldNames = ['created_at', 'updated_at', 'deleted_at', 'state'];
    for (const sysFieldName of systemFieldNames) {
        if (!existingColumns[sysFieldName]) {
            const colDef = getSystemColumnDef(sysFieldName);
            if (colDef) {
                Logger.debug(`  + 新增系统字段 ${sysFieldName}`);
                addClauses.push(`ADD COLUMN ${colDef}`);
                changed = true;
            }
        }
    }

    // 检查系统字段索引（字段存在或即将被添加时才创建索引）
    for (const sysField of SYSTEM_INDEX_FIELDS) {
        const idxName = `idx_${sysField}`;
        // 字段已存在或刚添加到 addClauses 中
        const fieldWillExist = existingColumns[sysField] || systemFieldNames.includes(sysField);
        if (fieldWillExist && !existingIndexes[idxName]) {
            indexActions.push({ action: 'create', indexName: idxName, fieldName: sysField });
            changed = true;
        }
    }

    // 检查业务字段索引
    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        // 转换字段名为下划线格式
        const dbFieldName = snakeCase(fieldKey);

        const indexName = `idx_${dbFieldName}`;
        if (fieldDef.index && !existingIndexes[indexName]) {
            indexActions.push({ action: 'create', indexName: indexName, fieldName: dbFieldName });
            changed = true;
        } else if (!fieldDef.index && existingIndexes[indexName] && existingIndexes[indexName].length === 1) {
            indexActions.push({ action: 'drop', indexName: indexName, fieldName: dbFieldName });
            changed = true;
        }
    }

    // PG 列注释处理
    const commentActions = [];
    if (isPG()) {
        for (const [fieldKey, fieldDef] of Object.entries(fields)) {
            // 转换字段名为下划线格式
            const dbFieldName = snakeCase(fieldKey);

            if (existingColumns[dbFieldName]) {
                const curr = existingColumns[dbFieldName].comment || '';
                const want = fieldDef.name && fieldDef.name !== 'null' ? String(fieldDef.name) : '';
                if (want !== curr) {
                    // 防止 SQL 注入：转义单引号
                    const escapedWant = want.replace(/'/g, "''");
                    commentActions.push(`COMMENT ON COLUMN "${tableName}"."${dbFieldName}" IS ${want ? `'${escapedWant}'` : 'NULL'}`);
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
        await applyTablePlan(sql, tableName, fields, plan);
    }

    return plan;
}
