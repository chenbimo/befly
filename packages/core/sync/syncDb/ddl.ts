/**
 * syncDb DDL 构建模块
 *
 * 包含：
 * - 构建索引 SQL
 * - 生成 DDL 子句（添加/修改列）
 * - 安全执行 DDL（MySQL 降级策略）
 * - 构建系统列和业务列定义
 */

import { snakeCase } from 'es-toolkit/string';
import { Logger } from '../../lib/logger.js';
import { isMySQL, isPG, getTypeMapping } from './constants.js';
import { quoteIdentifier, escapeComment } from './helpers.js';
import { resolveDefaultValue, generateDefaultSql, getSqlType } from './types.js';

import type { SQL } from 'bun';
import type { FieldDefinition } from 'befly-shared/types';
import type { AnyObject } from '../../types/common.js';

/**
 * 构建索引操作 SQL（统一使用在线策略）
 *
 * @param tableName - 表名
 * @param indexName - 索引名
 * @param fieldName - 字段名
 * @param action - 操作类型（create/drop）
 * @returns SQL 语句
 */
export function buildIndexSQL(tableName: string, indexName: string, fieldName: string, action: 'create' | 'drop'): string {
    const tableQuoted = quoteIdentifier(tableName);
    const indexQuoted = quoteIdentifier(indexName);
    const fieldQuoted = quoteIdentifier(fieldName);

    if (isMySQL()) {
        const parts = [];
        if (action === 'create') {
            parts.push(`ADD INDEX ${indexQuoted} (${fieldQuoted})`);
        } else {
            parts.push(`DROP INDEX ${indexQuoted}`);
        }
        // 始终使用在线算法
        parts.push('ALGORITHM=INPLACE');
        parts.push('LOCK=NONE');
        return `ALTER TABLE ${tableQuoted} ${parts.join(', ')}`;
    }

    if (isPG()) {
        if (action === 'create') {
            // 始终使用 CONCURRENTLY
            return `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexQuoted} ON ${tableQuoted}(${fieldQuoted})`;
        }
        return `DROP INDEX CONCURRENTLY IF EXISTS ${indexQuoted}`;
    }

    // SQLite
    if (action === 'create') {
        return `CREATE INDEX IF NOT EXISTS ${indexQuoted} ON ${tableQuoted}(${fieldQuoted})`;
    }
    return `DROP INDEX IF EXISTS ${indexQuoted}`;
}

/**
 * 构建系统字段列定义
 *
 * @returns 系统字段的列定义数组
 */
export function buildSystemColumnDefs(): string[] {
    if (isMySQL()) {
        return ['`id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT "主键ID"', '`created_at` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT "创建时间"', '`updated_at` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT "更新时间"', '`deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT "删除时间"', '`state` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT "状态字段"'];
    }
    return ['"id" INTEGER PRIMARY KEY', '"created_at" INTEGER NOT NULL DEFAULT 0', '"updated_at" INTEGER NOT NULL DEFAULT 0', '"deleted_at" INTEGER NOT NULL DEFAULT 0', '"state" INTEGER NOT NULL DEFAULT 0'];
}

/**
 * 构建业务字段列定义
 *
 * @param fields - 字段定义对象
 * @returns 业务字段的列定义数组
 */
export function buildBusinessColumnDefs(fields: Record<string, FieldDefinition>): string[] {
    const colDefs: string[] = [];

    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        // 转换字段名为下划线格式
        const dbFieldName = snakeCase(fieldKey);

        const sqlType = getSqlType(fieldDef.type, fieldDef.max, fieldDef.unsigned);

        // 使用公共函数处理默认值
        const actualDefault = resolveDefaultValue(fieldDef.default, fieldDef.type);
        const defaultSql = generateDefaultSql(actualDefault, fieldDef.type);

        // 构建约束
        const uniqueSql = fieldDef.unique ? ' UNIQUE' : '';
        const nullableSql = fieldDef.nullable ? ' NULL' : ' NOT NULL';

        if (isMySQL()) {
            colDefs.push(`\`${dbFieldName}\` ${sqlType}${uniqueSql}${nullableSql}${defaultSql} COMMENT "${escapeComment(fieldDef.name)}"`);
        } else {
            colDefs.push(`"${dbFieldName}" ${sqlType}${uniqueSql}${nullableSql}${defaultSql}`);
        }
    }

    return colDefs;
}

/**
 * 生成字段 DDL 子句（不含 ALTER TABLE 前缀）
 *
 * @param fieldKey - 字段键名
 * @param fieldDef - 字段定义对象
 * @param isAdd - 是否为添加字段（true）还是修改字段（false）
 * @returns DDL 子句
 */
export function generateDDLClause(fieldKey: string, fieldDef: FieldDefinition, isAdd: boolean = false): string {
    // 转换字段名为下划线格式
    const dbFieldName = snakeCase(fieldKey);

    const sqlType = getSqlType(fieldDef.type, fieldDef.max, fieldDef.unsigned);

    // 使用公共函数处理默认值
    const actualDefault = resolveDefaultValue(fieldDef.default, fieldDef.type);
    const defaultSql = generateDefaultSql(actualDefault, fieldDef.type);

    // 构建约束
    const uniqueSql = fieldDef.unique ? ' UNIQUE' : '';
    const nullableSql = fieldDef.nullable ? ' NULL' : ' NOT NULL';

    if (isMySQL()) {
        return `${isAdd ? 'ADD COLUMN' : 'MODIFY COLUMN'} \`${dbFieldName}\` ${sqlType}${uniqueSql}${nullableSql}${defaultSql} COMMENT "${escapeComment(fieldDef.name)}"`;
    }
    if (isPG()) {
        if (isAdd) return `ADD COLUMN IF NOT EXISTS "${dbFieldName}" ${sqlType}${uniqueSql}${nullableSql}${defaultSql}`;
        // PG 修改：类型与非空可分条执行，生成 TYPE 改变；非空另由上层统一控制
        return `ALTER COLUMN "${dbFieldName}" TYPE ${sqlType}`;
    }
    // SQLite 仅支持 ADD COLUMN（>=3.50.0：支持 IF NOT EXISTS）
    if (isAdd) return `ADD COLUMN IF NOT EXISTS "${dbFieldName}" ${sqlType}${uniqueSql}${nullableSql}${defaultSql}`;
    return '';
}

/**
 * 安全执行 DDL 语句（MySQL 降级策略）
 *
 * 执行 DDL 时按以下顺序尝试：
 * 1. ALGORITHM=INSTANT (最快，无表锁)
 * 2. ALGORITHM=INPLACE (在线 DDL)
 * 3. 传统 DDL (可能需要表锁)
 *
 * @param sql - SQL 客户端实例
 * @param stmt - DDL 语句
 * @returns 是否执行成功
 * @throws {Error} 如果所有尝试都失败
 */
export async function executeDDLSafely(sql: SQL, stmt: string): Promise<boolean> {
    try {
        await sql.unsafe(stmt);
        return true;
    } catch (error: any) {
        // MySQL 专用降级路径
        if (stmt.includes('ALGORITHM=INSTANT')) {
            const inplaceSql = stmt.replace(/ALGORITHM=INSTANT/g, 'ALGORITHM=INPLACE');
            try {
                await sql.unsafe(inplaceSql);
                return true;
            } catch (inplaceError) {
                // 最后尝试传统DDL：移除 ALGORITHM/LOCK 附加子句后执行
                const traditionSql = stmt
                    .replace(/,\s*ALGORITHM=INPLACE/g, '')
                    .replace(/,\s*ALGORITHM=INSTANT/g, '')
                    .replace(/,\s*LOCK=(NONE|SHARED|EXCLUSIVE)/g, '');
                await sql.unsafe(traditionSql);
                return true;
            }
        } else {
            throw error;
        }
    }
}

/**
 * PG 兼容类型变更识别：无需数据重写的宽化型变更
 *
 * @param currentType - 当前类型
 * @param newType - 新类型
 * @returns 是否为兼容变更
 */
export function isPgCompatibleTypeChange(currentType: string, newType: string): boolean {
    const c = String(currentType || '').toLowerCase();
    const n = String(newType || '').toLowerCase();
    // varchar -> text 视为宽化
    if (c === 'character varying' && n === 'text') return true;
    // text -> character varying 非宽化（可能截断），不兼容
    return false;
}
