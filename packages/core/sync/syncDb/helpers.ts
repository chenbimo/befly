/**
 * syncDb 辅助工具模块
 *
 * 包含：
 * - 标识符引用（反引号/双引号转义）
 * - 日志输出格式化
 * - 字段默认值应用
 */

import { isMySQL, isPG } from './constants.js';
import { Logger } from '../../lib/logger.js';

// 从 types.ts 重新导出，保持向后兼容
export { isStringOrArrayType, getSqlType, resolveDefaultValue, generateDefaultSql } from './types.js';

/**
 * 根据数据库类型引用标识符
 *
 * @param identifier - 标识符（表名、列名等）
 * @returns 引用后的标识符
 *
 * @example
 * quoteIdentifier('user_table')
 * // MySQL: `user_table`
 * // PostgreSQL: "user_table"
 * // SQLite: user_table
 */
export function quoteIdentifier(identifier: string): string {
    if (isMySQL()) return `\`${identifier}\``;
    if (isPG()) return `"${identifier}"`;
    return identifier; // SQLite 无需引用
}

/**
 * 转义 SQL 注释中的双引号
 *
 * @param str - 注释字符串
 * @returns 转义后的字符串
 *
 * @example
 * escapeComment('用户名称') // => '用户名称'
 * escapeComment('用户"昵称"') // => '用户\\"昵称\\"'
 */
export function escapeComment(str: string): string {
    return String(str).replace(/"/g, '\\"');
}

/**
 * 记录字段变更信息（紧凑格式）
 *
 * @param tableName - 表名
 * @param fieldName - 字段名
 * @param changeType - 变更类型（length/datatype/comment/default）
 * @param oldValue - 旧值
 * @param newValue - 新值
 * @param changeLabel - 变更类型的中文标签
 */
export function logFieldChange(tableName: string, fieldName: string, changeType: string, oldValue: any, newValue: any, changeLabel: string): void {
    Logger.debug(`  ~ 修改 ${fieldName} ${changeLabel}: ${oldValue} -> ${newValue}`);
}

/**
 * 格式化字段列表为可读字符串
 *
 * @param fields - 字段名数组
 * @returns 格式化的字符串（逗号分隔）
 */
export function formatFieldList(fields: string[]): string {
    return fields.map((f) => quoteIdentifier(f)).join(', ');
}

/**
 * 为字段定义应用默认值
 *
 * @param fieldDef - 字段定义对象
 */
export function applyFieldDefaults(fieldDef: any): void {
    fieldDef.detail = fieldDef.detail ?? '';
    fieldDef.min = fieldDef.min ?? 0;
    fieldDef.max = fieldDef.max ?? (fieldDef.type === 'number' ? Number.MAX_SAFE_INTEGER : 100);
    fieldDef.default = fieldDef.default ?? null;
    fieldDef.index = fieldDef.index ?? false;
    fieldDef.unique = fieldDef.unique ?? false;
    fieldDef.nullable = fieldDef.nullable ?? false;
    fieldDef.unsigned = fieldDef.unsigned ?? true;
    fieldDef.regexp = fieldDef.regexp ?? null;
}
