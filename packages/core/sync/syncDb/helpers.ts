/**
 * syncDb 辅助工具模块
 *
 * 包含：
 * - 标识符引用（反引号/双引号转义）
 * - 默认值处理
 * - 日志输出格式化
 */

import { IS_MYSQL, IS_PG, typeMapping } from './constants.js';
import { Logger } from '../util.js';

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
 * 处理默认值：将 null 或 'null' 字符串转换为对应类型的默认值
 *
 * @param fieldDefault - 字段默认值（可能是 null 或 'null' 字符串）
 * @param fieldType - 字段类型（number/string/text/array）
 * @returns 实际默认值
 *
 * @example
 * resolveDefaultValue(null, 'string') // => ''
 * resolveDefaultValue(null, 'number') // => 0
 * resolveDefaultValue('null', 'number') // => 0
 * resolveDefaultValue(null, 'array') // => '[]'
 * resolveDefaultValue(null, 'text') // => 'null'
 * resolveDefaultValue('admin', 'string') // => 'admin'
 * resolveDefaultValue(0, 'number') // => 0
 */
export function resolveDefaultValue(fieldDefault: any, fieldType: 'number' | 'string' | 'text' | 'array'): any {
    // null 或字符串 'null' 都表示使用类型默认值
    if (fieldDefault !== null && fieldDefault !== 'null') {
        return fieldDefault;
    }

    // null 表示使用类型默认值
    switch (fieldType) {
        case 'number':
            return 0;
        case 'string':
            return '';
        case 'array':
            return '[]';
        case 'text':
            // text 类型不设置默认值，保持 'null'
            return 'null';
        default:
            return fieldDefault;
    }
}

/**
 * 生成 SQL DEFAULT 子句
 *
 * @param actualDefault - 实际默认值（已经过 resolveDefaultValue 处理）
 * @param fieldType - 字段类型
 * @returns SQL DEFAULT 子句字符串（包含前导空格），如果不需要则返回空字符串
 *
 * @example
 * generateDefaultSql(0, 'number') // => ' DEFAULT 0'
 * generateDefaultSql('admin', 'string') // => " DEFAULT 'admin'"
 * generateDefaultSql('', 'string') // => " DEFAULT ''"
 * generateDefaultSql('null', 'text') // => ''
 */
export function generateDefaultSql(actualDefault: any, fieldType: 'number' | 'string' | 'text' | 'array'): string {
    // text 类型不设置默认值
    if (fieldType === 'text' || actualDefault === 'null') {
        return '';
    }

    // 仅 number/string/array 类型设置默认值
    if (fieldType === 'number' || fieldType === 'string' || fieldType === 'array') {
        if (typeof actualDefault === 'number' && !Number.isNaN(actualDefault)) {
            return ` DEFAULT ${actualDefault}`;
        } else {
            // 字符串需要转义单引号：' -> ''
            const escaped = String(actualDefault).replace(/'/g, "''");
            return ` DEFAULT '${escaped}'`;
        }
    }

    return '';
}

/**
 * 判断是否为字符串或数组类型（需要长度参数）
 *
 * @param fieldType - 字段类型
 * @returns 是否为字符串或数组类型
 *
 * @example
 * isStringOrArrayType('string') // => true
 * isStringOrArrayType('array_string') // => true
 * isStringOrArrayType('array_text') // => false
 * isStringOrArrayType('number') // => false
 * isStringOrArrayType('text') // => false
 */
export function isStringOrArrayType(fieldType: string): boolean {
    return fieldType === 'string' || fieldType === 'array_string';
}

/**
 * 获取 SQL 数据类型
 *
 * @param fieldType - 字段类型（number/string/text/array_string/array_text）
 * @param fieldMax - 最大长度（string/array_string 类型需要）
 * @param unsigned - 是否无符号（仅 MySQL number 类型有效）
 * @returns SQL 类型字符串
 *
 * @example
 * getSqlType('string', 100) // => 'VARCHAR(100)'
 * getSqlType('number', null, true) // => 'BIGINT UNSIGNED'
 * getSqlType('text', null) // => 'MEDIUMTEXT'
 * getSqlType('array_string', 500) // => 'VARCHAR(500)'
 * getSqlType('array_text', null) // => 'MEDIUMTEXT'
 */
export function getSqlType(fieldType: string, fieldMax: number | null, unsigned: boolean = false): string {
    if (isStringOrArrayType(fieldType)) {
        return `${typeMapping[fieldType]}(${fieldMax})`;
    }
    // 处理 UNSIGNED 修饰符（仅 MySQL number 类型）
    const baseType = typeMapping[fieldType] || 'TEXT';
    if (IS_MYSQL && fieldType === 'number' && unsigned) {
        return `${baseType} UNSIGNED`;
    }
    return baseType;
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
    Logger.info(`  ~ 修改 ${fieldName} ${changeLabel}: ${oldValue} -> ${newValue}`);
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
    fieldDef.max = fieldDef.max ?? 100;
    fieldDef.default = fieldDef.default ?? null;
    fieldDef.index = fieldDef.index ?? false;
    fieldDef.unique = fieldDef.unique ?? false;
    fieldDef.comment = fieldDef.comment ?? '';
    fieldDef.nullable = fieldDef.nullable ?? false;
    fieldDef.unsigned = fieldDef.unsigned ?? true;
    fieldDef.regexp = fieldDef.regexp ?? null;
}
