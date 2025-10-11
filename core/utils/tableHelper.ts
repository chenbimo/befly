/**
 * Befly 表定义工具
 * 提供表字段规则解析功能
 */

import type { ParsedFieldRule } from '../types/common.js';

/**
 * 解析字段规则字符串（以 ⚡ 分隔）
 * 用于解析表定义中的字段规则
 *
 * 规则格式：字段名⚡类型⚡最小值⚡最大值⚡默认值⚡索引⚡正则
 *
 * @param rule - 字段规则字符串
 * @returns 解析后的字段规则对象
 *
 * @example
 * parseRule('用户名⚡string⚡2⚡50⚡null⚡1⚡null')
 * // {
 * //   label: '用户名',
 * //   type: 'string',
 * //   min: 2,
 * //   max: 50,
 * //   default: 'null',
 * //   index: 1,
 * //   regex: null
 * // }
 *
 * parseRule('年龄⚡number⚡0⚡150⚡18⚡0⚡null')
 * // {
 * //   label: '年龄',
 * //   type: 'number',
 * //   min: 0,
 * //   max: 150,
 * //   default: 18,
 * //   index: 0,
 * //   regex: null
 * // }
 */
export const parseRule = (rule: string): ParsedFieldRule => {
    const parts = rule.split('⚡');
    const [fieldName = '', fieldType = 'string', fieldMinStr = 'null', fieldMaxStr = 'null', fieldDefaultStr = 'null', fieldIndexStr = '0', fieldRegx = 'null'] = parts;

    const fieldIndex = Number(fieldIndexStr) as 0 | 1;
    const fieldMin = fieldMinStr !== 'null' ? Number(fieldMinStr) : null;
    const fieldMax = fieldMaxStr !== 'null' ? Number(fieldMaxStr) : null;

    let fieldDefault: any = fieldDefaultStr;
    if (fieldType === 'number' && fieldDefaultStr !== 'null') {
        fieldDefault = Number(fieldDefaultStr);
    }

    return {
        label: fieldName,
        type: fieldType as 'string' | 'number' | 'text' | 'array',
        min: fieldMin,
        max: fieldMax,
        default: fieldDefault,
        index: fieldIndex,
        regex: fieldRegx !== 'null' ? fieldRegx : null
    };
};
