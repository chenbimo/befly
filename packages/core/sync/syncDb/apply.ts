/**
 * syncDb 变更应用模块
 *
 * 包含：
 * - 比较字段定义变化
 * - 应用表结构变更计划
 */

import { Logger } from '../../lib/logger.js';
import { isMySQL, isPG, isSQLite, IS_PLAN, CHANGE_TYPE_LABELS, getTypeMapping } from './constants.js';
import { logFieldChange, resolveDefaultValue, isStringOrArrayType } from './helpers.js';
import { executeDDLSafely, buildIndexSQL } from './ddl.js';
import { rebuildSqliteTable } from './sqlite.js';
import type { FieldChange, IndexAction, TablePlan, ColumnInfo } from '../../types/sync.js';
import type { SQL } from 'bun';
import type { FieldDefinition } from 'befly-shared/types';

/**
 * 构建 ALTER TABLE SQL 语句
 *
 * 根据数据库类型构建相应的 ALTER TABLE 语句：
 * - MySQL: 添加 ALGORITHM=INSTANT, LOCK=NONE 优化参数
 * - PostgreSQL/SQLite: 使用双引号标识符
 *
 * @param tableName - 表名
 * @param clauses - SQL 子句数组
 * @returns 完整的 ALTER TABLE 语句
 */
function buildAlterTableSQL(tableName: string, clauses: string[]): string {
    if (isMySQL()) {
        return `ALTER TABLE \`${tableName}\` ${clauses.join(', ')}, ALGORITHM=INSTANT, LOCK=NONE`;
    }
    return `ALTER TABLE "${tableName}" ${clauses.join(', ')}`;
}

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
export function compareFieldDefinition(existingColumn: ColumnInfo, fieldDef: FieldDefinition): FieldChange[] {
    const changes: FieldChange[] = [];

    // 检查长度变化（string和array类型） - SQLite 不比较长度
    if (!isSQLite() && isStringOrArrayType(fieldDef.type)) {
        if (existingColumn.max !== fieldDef.max) {
            changes.push({
                type: 'length',
                current: existingColumn.max,
                expected: fieldDef.max
            });
        }
    }

    // 检查注释变化（MySQL/PG 支持列注释，对比数据库 comment 与字段 name）
    if (!isSQLite()) {
        const currentComment = existingColumn.comment || '';
        if (currentComment !== fieldDef.name) {
            changes.push({
                type: 'comment',
                current: currentComment,
                expected: fieldDef.name
            });
        }
    }

    // 检查数据类型变化（只对比基础类型）
    const typeMapping = getTypeMapping();
    const expectedType = typeMapping[fieldDef.type].toLowerCase();
    const currentType = existingColumn.type.toLowerCase();

    if (currentType !== expectedType) {
        changes.push({
            type: 'datatype',
            current: currentType,
            expected: expectedType
        });
    }

    // 检查 nullable 变化
    const expectedNullable = fieldDef.nullable;
    if (existingColumn.nullable !== expectedNullable) {
        changes.push({
            type: 'nullable',
            current: existingColumn.nullable,
            expected: expectedNullable
        });
    }

    // 使用公共函数处理默认值
    const expectedDefault = resolveDefaultValue(fieldDef.default, fieldDef.type);

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
 */
export async function applyTablePlan(sql: SQL, tableName: string, fields: Record<string, FieldDefinition>, plan: TablePlan): Promise<void> {
    if (!plan || !plan.changed) return;

    // SQLite: 仅支持部分 ALTER；需要时走重建
    if (isSQLite()) {
        if (plan.modifyClauses.length > 0 || plan.defaultClauses.length > 0) {
            if (IS_PLAN) Logger.debug(`[计划] 重建表 ${tableName} 以应用列修改/默认值变化`);
            else await rebuildSqliteTable(sql, tableName, fields);
        } else {
            for (const c of plan.addClauses) {
                const stmt = `ALTER TABLE "${tableName}" ${c}`;
                if (IS_PLAN) Logger.debug(`[计划] ${stmt}`);
                else await sql.unsafe(stmt);
            }
        }
    } else {
        const clauses = [...plan.addClauses, ...plan.modifyClauses];
        if (clauses.length > 0) {
            const stmt = buildAlterTableSQL(tableName, clauses);
            if (IS_PLAN) Logger.debug(`[计划] ${stmt}`);
            else if (isMySQL()) await executeDDLSafely(sql, stmt);
            else await sql.unsafe(stmt);
        }
    }

    // 默认值专用 ALTER（SQLite 不支持）
    if (plan.defaultClauses.length > 0) {
        if (isSQLite()) {
            Logger.warn(`SQLite 不支持修改默认值，表 ${tableName} 的默认值变更已跳过`);
        } else {
            const stmt = buildAlterTableSQL(tableName, plan.defaultClauses);
            if (IS_PLAN) Logger.debug(`[计划] ${stmt}`);
            else if (isMySQL()) await executeDDLSafely(sql, stmt);
            else await sql.unsafe(stmt);
        }
    }

    // 索引操作
    for (const act of plan.indexActions) {
        const stmt = buildIndexSQL(tableName, act.indexName, act.fieldName, act.action);
        if (IS_PLAN) {
            Logger.debug(`[计划] ${stmt}`);
        } else {
            try {
                await sql.unsafe(stmt);
                if (act.action === 'create') {
                    Logger.debug(`[索引变化] 新建索引 ${tableName}.${act.indexName} (${act.fieldName})`);
                } else {
                    Logger.debug(`[索引变化] 删除索引 ${tableName}.${act.indexName} (${act.fieldName})`);
                }
            } catch (error: any) {
                Logger.error({ err: error, table: tableName, index: act.indexName, field: act.fieldName }, `${act.action === 'create' ? '创建' : '删除'}索引失败`);
                throw error;
            }
        }
    }

    // PG 列注释
    if (isPG() && plan.commentActions && plan.commentActions.length > 0) {
        for (const stmt of plan.commentActions) {
            if (IS_PLAN) Logger.info(`[计划] ${stmt}`);
            else await sql.unsafe(stmt);
        }
    }
}
