/**
 * syncDb 变更应用模块
 *
 * 包含：
 * - 比较字段定义变化
 * - 应用表结构变更计划
 */

import { Logger } from '../../util.js';
import { IS_MYSQL, IS_PG, IS_SQLITE, CHANGE_TYPE_LABELS, typeMapping } from './constants.js';
import { logFieldChange, resolveDefaultValue, isStringOrArrayType } from './helpers.js';
import { executeDDLSafely, buildIndexSQL } from './ddl.js';
import { rebuildSqliteTable } from './sqlite.js';
import type { FieldChange, IndexAction, TablePlan, ColumnInfo } from '../../types.js';
import type { SQL } from 'bun';
import type { FieldDefinition } from 'befly/types/common';

// 是否为计划模式（从环境变量读取）
const IS_PLAN = process.argv.includes('--plan');

/**
 * 比较字段定义变化
 *
 * 对比现有列信息和新的字段规则，识别变化类型：
 * - 长度变化（string/array 类型）
 * - 注释变化（MySQL/PG）
 * - 数据类型变化
 * - 默认值变化
 *
 * @param existingColumn - 现有列信息
 * @param fieldDef - 新的字段定义对象
 * @param colName - 列名（未使用，保留参数兼容性）
 * @returns 变化数组
 */
export function compareFieldDefinition(existingColumn: ColumnInfo, fieldDef: FieldDefinition, colName: string): FieldChange[] {
    const { name: fieldName, type: fieldType, max: fieldMax, default: fieldDefault, unique, nullable, unsigned } = fieldDef;
    const changes: FieldChange[] = [];

    // 检查长度变化（string和array类型） - SQLite 不比较长度
    if (!IS_SQLITE && isStringOrArrayType(fieldType)) {
        if (existingColumn.length !== fieldMax) {
            changes.push({
                type: 'length',
                current: existingColumn.length,
                expected: fieldMax
            });
        }
    }

    // 检查注释变化（MySQL/PG 支持列注释）
    if (!IS_SQLITE) {
        const currentComment = existingColumn.comment || '';
        if (currentComment !== fieldName) {
            changes.push({
                type: 'comment',
                current: currentComment,
                expected: fieldName
            });
        }
    }

    // 检查数据类型变化（包含 UNSIGNED 修饰符）
    const expectedType = IS_MYSQL && fieldType === 'number' && unsigned ? `${typeMapping[fieldType].toLowerCase()} unsigned` : typeMapping[fieldType].toLowerCase();

    const currentType = existingColumn.columnType?.toLowerCase() || existingColumn.type.toLowerCase();

    if (currentType !== expectedType) {
        changes.push({
            type: 'datatype',
            current: currentType,
            expected: expectedType
        });
    }

    // 检查 nullable 变化
    const expectedNullable = nullable === true;
    if (existingColumn.nullable !== expectedNullable) {
        changes.push({
            type: 'nullable',
            current: existingColumn.nullable,
            expected: expectedNullable
        });
    }

    // 使用公共函数处理默认值
    const expectedDefault = resolveDefaultValue(fieldDefault, fieldType);

    // 检查默认值变化
    if (String(existingColumn.defaultValue) !== String(expectedDefault)) {
        changes.push({
            type: 'default',
            current: existingColumn.defaultValue,
            expected: expectedDefault
        });
    }

    return changes;
}

/**
 * 将表结构计划应用到数据库（执行 DDL/索引/注释等）
 *
 * 根据数据库方言和计划内容，执行相应的 DDL 操作：
 * - SQLite: 新增字段直接 ALTER，其他操作需要重建表
 * - MySQL: 尝试在线 DDL（INSTANT/INPLACE）
 * - PostgreSQL: 直接 ALTER
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @param fields - 字段定义对象
 * @param plan - 表结构变更计划
 * @param globalCount - 全局统计对象（用于计数）
 */
export async function applyTablePlan(sql: SQL, tableName: string, fields: Record<string, FieldDefinition>, plan: TablePlan, globalCount: Record<string, number>): Promise<void> {
    if (!plan || !plan.changed) return;

    // SQLite: 仅支持部分 ALTER；需要时走重建
    if (IS_SQLITE) {
        if (plan.modifyClauses.length > 0 || plan.defaultClauses.length > 0) {
            if (IS_PLAN) Logger.info(`[计划] 重建表 ${tableName} 以应用列修改/默认值变化`);
            else await rebuildSqliteTable(sql, tableName, fields);
        } else {
            for (const c of plan.addClauses) {
                const stmt = `ALTER TABLE "${tableName}" ${c}`;
                if (IS_PLAN) Logger.info(`[计划] ${stmt}`);
                else await sql.unsafe(stmt);
            }
        }
    } else {
        const clauses = [...plan.addClauses, ...plan.modifyClauses];
        if (clauses.length > 0) {
            const suffix = IS_MYSQL ? ', ALGORITHM=INSTANT, LOCK=NONE' : '';
            const stmt = IS_MYSQL ? `ALTER TABLE \`${tableName}\` ${clauses.join(', ')}${suffix}` : `ALTER TABLE "${tableName}" ${clauses.join(', ')}`;
            if (IS_PLAN) Logger.info(`[计划] ${stmt}`);
            else if (IS_MYSQL) await executeDDLSafely(sql, stmt);
            else await sql.unsafe(stmt);
        }
    }

    // 默认值专用 ALTER（SQLite 不支持）
    if (plan.defaultClauses.length > 0) {
        if (IS_SQLITE) {
            Logger.warn(`SQLite 不支持修改默认值，表 ${tableName} 的默认值变更已跳过`);
        } else {
            const suffix = IS_MYSQL ? ', ALGORITHM=INSTANT, LOCK=NONE' : '';
            const stmt = IS_MYSQL ? `ALTER TABLE \`${tableName}\` ${plan.defaultClauses.join(', ')}${suffix}` : `ALTER TABLE "${tableName}" ${plan.defaultClauses.join(', ')}`;
            if (IS_PLAN) Logger.info(`[计划] ${stmt}`);
            else if (IS_MYSQL) await executeDDLSafely(sql, stmt);
            else await sql.unsafe(stmt);
        }
    }

    // 索引操作
    for (const act of plan.indexActions) {
        const stmt = buildIndexSQL(tableName, act.indexName, act.fieldName, act.action);
        if (IS_PLAN) {
            Logger.info(`[计划] ${stmt}`);
        } else {
            try {
                await sql.unsafe(stmt);
                if (act.action === 'create') {
                    Logger.info(`[索引变化] 新建索引 ${tableName}.${act.indexName} (${act.fieldName})`);
                } else {
                    Logger.info(`[索引变化] 删除索引 ${tableName}.${act.indexName} (${act.fieldName})`);
                }
            } catch (error: any) {
                Logger.error(`${act.action === 'create' ? '创建' : '删除'}索引失败:`, error);
                Logger.warn(`表名: ${tableName}, 索引名: ${act.indexName}, 字段: ${act.fieldName}`);
                throw error;
            }
        }
    }

    // PG 列注释
    if (IS_PG && plan.commentActions && plan.commentActions.length > 0) {
        for (const stmt of plan.commentActions) {
            if (IS_PLAN) Logger.info(`[计划] ${stmt}`);
            else await sql.unsafe(stmt);
        }
    }

    // 计数
    globalCount.modifiedTables++;
}
