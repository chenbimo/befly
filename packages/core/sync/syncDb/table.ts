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
import { IS_MYSQL, IS_PG, IS_SQLITE, SYSTEM_INDEX_FIELDS, CHANGE_TYPE_LABELS, typeMapping } from './constants.js';
import { quoteIdentifier, logFieldChange, resolveDefaultValue, generateDefaultSql, isStringOrArrayType, getSqlType } from './helpers.js';
import { buildIndexSQL, generateDDLClause, isPgCompatibleTypeChange } from './ddl.js';
import { getTableColumns, getTableIndexes } from './schema.js';
import { compareFieldDefinition, applyTablePlan } from './apply.js';
import { createTable } from './tableCreate.js';
import type { TablePlan, ColumnInfo } from '../../types.js';
import type { SQL } from 'bun';
import type { FieldDefinition } from 'befly/types/common';

// 是否为计划模式（从环境变量读取）
const IS_PLAN = process.argv.includes('--plan');

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
 * @param tableDefinition - 表定义（JSON）
 * @param force - 是否强制同步（删除多余字段）
 * @param dbName - 数据库名称
 */
export async function modifyTable(sql: SQL, tableName: string, tableDefinition: TablePlan, force: boolean, dbName?: string): Promise<void> {
    try {
        // 1. 获取现有表结构
        const currentColumns = await getTableColumns(sql, tableName, dbName);
        const currentIndexes = await getTableIndexes(sql, tableName, dbName);

        // 2. 对比字段变化
        const changes: string[] = [];
        const processedColumns = new Set<string>();
        const processedIndexes = new Set<string>();
        const newColumns: string[] = []; // 记录新增的列名，用于后续添加索引

        // 遍历定义中的字段
        for (const [fieldName, fieldDef] of Object.entries(tableDefinition)) {
            const snakeFieldName = snakeCase(fieldName);
            processedColumns.add(snakeFieldName);

            // 检查字段是否存在
            if (!currentColumns[snakeFieldName]) {
                // 新增字段
                changes.push(generateDDLClause('ADD_COLUMN', tableName, snakeFieldName, fieldDef));
                logFieldChange(tableName, snakeFieldName, 'add', '新增字段');
                newColumns.push(snakeFieldName);
            } else {
                // 修改字段
                const currentDef = currentColumns[snakeFieldName];
                const diff = compareFieldDefinition(fieldDef, currentDef);
                if (diff) {
                    changes.push(generateDDLClause('MODIFY_COLUMN', tableName, snakeFieldName, fieldDef));
                    logFieldChange(tableName, snakeFieldName, 'modify', `修改字段: ${diff}`);
                }
            }
        }

        // 检查多余字段（仅在 force 模式下删除）
        if (force) {
            for (const colName of Object.keys(currentColumns)) {
                if (!processedColumns.has(colName)) {
                    changes.push(generateDDLClause('DROP_COLUMN', tableName, colName));
                    logFieldChange(tableName, colName, 'drop', '删除多余字段');
                }
            }
        }

        // 3. 对比索引变化
        // 自动为 _id, _at 结尾的字段添加索引
        // 以及 unique=true 的字段
        const expectedIndexes: { [key: string]: string[] } = {};

        for (const [fieldName, fieldDef] of Object.entries(tableDefinition)) {
            const snakeFieldName = snakeCase(fieldName);

            // 唯一索引
            if (fieldDef.unique) {
                const indexName = `uk_${tableName}_${snakeFieldName}`;
                expectedIndexes[indexName] = [snakeFieldName];
            }
            // 普通索引 (index=true 或 _id/_at 结尾)
            else if (fieldDef.index || snakeFieldName.endsWith('_id') || snakeFieldName.endsWith('_at')) {
                // 排除主键 id
                if (snakeFieldName === 'id') continue;

                // 排除大文本类型
                if (['text', 'longtext', 'json'].includes(fieldDef.type || '')) continue;

                const indexName = `idx_${tableName}_${snakeFieldName}`;
                expectedIndexes[indexName] = [snakeFieldName];
            }
        }

        // 检查新增/修改索引
        for (const [indexName, columns] of Object.entries(expectedIndexes)) {
            processedIndexes.add(indexName);

            const currentIndex = currentIndexes[indexName];
            if (!currentIndex) {
                // 新增索引
                changes.push(buildIndexSQL('ADD', tableName, indexName, columns, indexName.startsWith('uk_')));
                logFieldChange(tableName, indexName, 'add_index', `新增索引 (${columns.join(',')})`);
            } else {
                // 索引存在，检查是否一致
                const isSame = currentIndex.length === columns.length && currentIndex.every((col, i) => col === columns[i]);

                if (!isSame) {
                    // 修改索引（先删后加）
                    changes.push(buildIndexSQL('DROP', tableName, indexName));
                    changes.push(buildIndexSQL('ADD', tableName, indexName, columns, indexName.startsWith('uk_')));
                    logFieldChange(tableName, indexName, 'modify_index', `修改索引 (${columns.join(',')})`);
                }
            }
        }

        // 检查多余索引（仅在 force 模式下删除）
        if (force) {
            for (const indexName of Object.keys(currentIndexes)) {
                // 跳过系统索引
                if (SYSTEM_INDEX_FIELDS.includes(indexName)) continue;

                if (!processedIndexes.has(indexName)) {
                    changes.push(buildIndexSQL('DROP', tableName, indexName));
                    logFieldChange(tableName, indexName, 'drop_index', '删除多余索引');
                }
            }
        }

        // 4. 执行变更
        if (changes.length > 0) {
            if (IS_PLAN) {
                // 计划模式：只输出 SQL
                Logger.info(`[PLAN] 表 ${tableName} 变更 SQL:`);
                for (const sqlStr of changes) {
                    console.log(sqlStr + ';');
                }
            } else {
                // 执行模式
                Logger.info(`正在同步表 ${tableName} 结构...`);
                for (const sqlStr of changes) {
                    try {
                        await sql.unsafe(sqlStr);
                    } catch (error: any) {
                        Logger.warn(`执行 SQL 失败: ${sqlStr} - ${error.message}`);
                        // 继续执行后续变更
                    }
                }
            }
        }
    } catch (error: any) {
        throw new Error(`同步表结构失败 [${tableName}]: ${error.message}`);
    }
}
export async function modifyTable(sql: SQL, tableName: string, fields: Record<string, FieldDefinition>, force: boolean = false): Promise<TablePlan> {
    const existingColumns = await getTableColumns(sql, tableName);
    const existingIndexes = await getTableIndexes(sql, tableName);
    let changed = false;

    const addClauses = [];
    const modifyClauses = [];
    const defaultClauses = [];
    const indexActions = [];

    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        // 转换字段名为下划线格式
        const dbFieldName = snakeCase(fieldKey);

        if (existingColumns[dbFieldName]) {
            const comparison = compareFieldDefinition(existingColumns[dbFieldName], fieldDef, dbFieldName);
            if (comparison.length > 0) {
                for (const c of comparison) {
                    // 使用统一的日志格式函数和常量标签
                    const changeLabel = CHANGE_TYPE_LABELS[c.type] || '未知';
                    logFieldChange(tableName, dbFieldName, c.type, c.current, c.expected, changeLabel);
                }

                if (isStringOrArrayType(fieldDef.type) && existingColumns[dbFieldName].max) {
                    if (existingColumns[dbFieldName].max > fieldDef.max) {
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

                // 严格限制：除 string/array 互转外，禁止任何字段类型变更
                if (hasTypeChange) {
                    const typeChange = comparison.find((c) => c.type === 'datatype');
                    const errorMsg = [`禁止字段类型变更: ${tableName}.${dbFieldName}`, `当前类型: ${typeChange?.current}`, `目标类型: ${typeChange?.expected}`, `说明: 仅允许 string<->array 互相切换，其他类型变更需要手动处理`].join('\n');
                    throw new Error(errorMsg);
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
                        if (IS_PG) {
                            defaultClauses.push(`ALTER COLUMN "${dbFieldName}" SET DEFAULT ${v}`);
                        } else if (IS_MYSQL && onlyDefaultChanged) {
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
                    if (hasLengthChange && isStringOrArrayType(fieldDef.type) && existingColumns[dbFieldName].max) {
                        const isShrink = existingColumns[dbFieldName].max > fieldDef.max;
                        if (isShrink && !force) skipModify = true;
                    }

                    if (hasTypeChange) {
                        if (IS_PG && isPgCompatibleTypeChange(existingColumns[dbFieldName].type, typeMapping[fieldDef.type].toLowerCase())) {
                            Logger.debug(`[PG兼容类型变更] ${tableName}.${dbFieldName} ${existingColumns[dbFieldName].type} -> ${typeMapping[fieldDef.type].toLowerCase()} 允许执行`);
                        }
                    }

                    if (!skipModify) modifyClauses.push(generateDDLClause(fieldKey, fieldDef, false));
                }
                changed = true;
            }
        } else {
            const lenPart = isStringOrArrayType(fieldDef.type) ? ` 长度:${parseInt(String(fieldDef.max))}` : '';
            Logger.debug(`  + 新增字段 ${dbFieldName} (${fieldDef.type}${lenPart})`);
            addClauses.push(generateDDLClause(fieldKey, fieldDef, true));
            changed = true;
        }
    }

    // 检查系统字段索引
    for (const sysField of ['created_at', 'updated_at', 'state']) {
        const idxName = `idx_${sysField}`;
        if (!existingIndexes[idxName]) {
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
    if (IS_PG) {
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
