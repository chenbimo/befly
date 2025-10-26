/**
 * syncDb 辅助函数模块
 *
 * 包含：
 * - SQL 标识符引用
 * - 日志格式化
 * - 类型判断工具
 * - 默认值处理
 */

import { util } from 'befly';
import { IS_MYSQL, IS_PG, typeMapping } from './constants.js';
import { Logger } from '../../utils/logger.js';

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
 * 处理默认值：将 'null' 字符串转换为对应类型的默认值
 *
 * @param fieldDefault - 字段默认值（可能是 'null' 字符串）
 * @param fieldType - 字段类型（number/string/text/array）
 * @returns 实际默认值
 *
 * @example
 * resolveDefaultValue('null', 'string') // => ''
 * resolveDefaultValue('null', 'number') // => 0
 * resolveDefaultValue('null', 'array') // => '[]'
 * resolveDefaultValue('null', 'text') // => 'null'
 * resolveDefaultValue('admin', 'string') // => 'admin'
 */
export function resolveDefaultValue(fieldDefault: any, fieldType: 'number' | 'string' | 'text' | 'array'): any {
    if (fieldDefault !== 'null') {
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
        if (util.isType(actualDefault, 'number')) {
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
 * 判断是否为字符串或数组类型（需要长度限制的类型）
 *
 * @param fieldType - 字段类型
 * @returns 是否为 string 或 array
 *
 * @example
 * isStringOrArrayType('string') // => true
 * isStringOrArrayType('array') // => true
 * isStringOrArrayType('number') // => false
 * isStringOrArrayType('text') // => false
 */
export function isStringOrArrayType(fieldType: string): boolean {
    return fieldType === 'string' || fieldType === 'array';
}

/**
 * 获取 SQL 数据类型
 *
 * @param fieldType - 字段类型（number/string/text/array）
 * @param fieldMax - 最大长度（string/array 类型需要）
 * @returns SQL 类型字符串
 *
 * @example
 * getSqlType('string', 100) // => 'VARCHAR(100)'
 * getSqlType('number', null) // => 'BIGINT'
 * getSqlType('text', null) // => 'TEXT'
 * getSqlType('array', 500) // => 'VARCHAR(500)'
 */
export function getSqlType(fieldType: string, fieldMax: number | null): string {
    if (isStringOrArrayType(fieldType)) {
        return `${typeMapping[fieldType]}(${fieldMax})`;
    }
    return typeMapping[fieldType];
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
    Logger.info(`   修改表 ${tableName} 的字段 ${fieldName} 的${changeLabel}: ${oldValue} -> ${newValue}`);
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
