/**
 * syncDb 类型处理模块
 *
 * 包含：
 * - SQL 类型映射和转换
 * - 默认值处理
 * - 类型判断工具
 */

import { IS_MYSQL, typeMapping } from './constants.js';

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
