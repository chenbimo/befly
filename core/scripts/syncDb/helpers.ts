/**
 * syncDb 辅助函数模块
 *
 * 包含：
 * - SQL 标识符引用
 * - 日志格式化
 * - 类型判断工具
 */

import { IS_MYSQL, IS_PG } from './constants.js';

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
    if (IS_MYSQL) return `\`${identifier}\``;
    if (IS_PG) return `"${identifier}"`;
    return identifier; // SQLite 无需引用
}

/**
 * 记录字段变更信息（带缩进和格式化）
 *
 * @param tableName - 表名
 * @param fieldName - 字段名
 * @param changeType - 变更类型（length/datatype/comment/default）
 * @param oldValue - 旧值
 * @param newValue - 新值
 * @param changeLabel - 变更类型的中文标签
 */
export function logFieldChange(tableName: string, fieldName: string, changeType: string, oldValue: any, newValue: any, changeLabel: string): void {
    console.log(`   修改表 ${tableName} 的字段 ${fieldName} 的${changeLabel}: ${oldValue} -> ${newValue}`);
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
