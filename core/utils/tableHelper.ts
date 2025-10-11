/**
 * Befly 表定义工具
 * 提供表字段规则解析功能
 */

import type { ParsedFieldRule } from '../types/common.js';

/**
 * 解析字段规则字符串（以 | 分隔）
 * 用于解析表定义中的字段规则
 *
 * 规则格式：字段名|类型|最小值|最大值|默认值|索引|正则
 * 注意：只分割前6个|，第7个|之后的所有内容（包括|）都属于正则表达式
 *
 * @param rule - 字段规则字符串
 * @returns 解析后的字段规则对象
 *
 * @example
 * parseRule('用户名|string|2|50|null|1|null')
 * // {
 * //   name: '用户名',
 * //   type: 'string',
 * //   min: 2,
 * //   max: 50,
 * //   default: 'null',
 * //   index: 1,
 * //   regex: null
 * // }
 *
 * parseRule('年龄|number|0|150|18|0|null')
 * // {
 * //   name: '年龄',
 * //   type: 'number',
 * //   min: 0,
 * //   max: 150,
 * //   default: 18,
 * //   index: 0,
 * //   regex: null
 * // }
 *
 * parseRule('状态|string|1|20|active|1|^(active|inactive|pending)$')
 * // 正则表达式中的 | 会被保留
 */
export const parseRule = (rule: string): ParsedFieldRule => {
    // 手动分割前6个|，剩余部分作为正则表达式
    // 这样可以确保正则表达式中的|不会被分割
    const parts: string[] = [];
    let currentPart = '';
    let pipeCount = 0;

    for (let i = 0; i < rule.length; i++) {
        if (rule[i] === '|' && pipeCount < 6) {
            parts.push(currentPart);
            currentPart = '';
            pipeCount++;
        } else {
            currentPart += rule[i];
        }
    }
    // 添加最后一部分（正则表达式）
    parts.push(currentPart);

    const [fieldName = '', fieldType = 'string', fieldMinStr = 'null', fieldMaxStr = 'null', fieldDefaultStr = 'null', fieldIndexStr = '0', fieldRegx = 'null'] = parts;

    const fieldIndex = Number(fieldIndexStr) as 0 | 1;
    const fieldMin = fieldMinStr !== 'null' ? Number(fieldMinStr) : null;
    const fieldMax = fieldMaxStr !== 'null' ? Number(fieldMaxStr) : null;

    let fieldDefault: any = fieldDefaultStr;
    if (fieldType === 'number' && fieldDefaultStr !== 'null') {
        fieldDefault = Number(fieldDefaultStr);
    }

    return {
        name: fieldName,
        type: fieldType as 'string' | 'number' | 'text' | 'array',
        min: fieldMin,
        max: fieldMax,
        default: fieldDefault,
        index: fieldIndex,
        regex: fieldRegx !== 'null' ? fieldRegx : null
    };
};
