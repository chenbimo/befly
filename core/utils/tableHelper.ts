/**
 * Befly 表定义工具
 * 提供表字段规则解析功能
 */

import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { getProjectDir } from '../system.js';
import { getAddonDir } from './addonHelper.js';
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

/**
 * 从表定义中加载字段
 * @param tableName - 表名
 * @param options - 可选配置
 * @returns 字段定义对象
 */
export function loadTableFields(
    tableName: string,
    options?: {
        source?: 'core' | 'project' | 'addon';
        addonName?: string;
    }
): Record<string, string> {
    const source = options?.source || 'project';
    const addonName = options?.addonName || '';

    let tableFilePath: string;

    // 根据来源确定表定义文件路径
    if (source === 'core') {
        tableFilePath = path.join(import.meta.dir, '../tables', `${tableName}.json`);
    } else if (source === 'addon') {
        if (!addonName) {
            throw new Error('addon 来源必须提供 addonName 参数');
        }
        tableFilePath = path.join(getAddonDir(addonName, 'tables'), `${tableName}.json`);
    } else {
        tableFilePath = path.join(getProjectDir('tables'), `${tableName}.json`);
    }

    // 检查文件是否存在
    if (!existsSync(tableFilePath)) {
        throw new Error(`表定义文件不存在: ${tableFilePath}`);
    }

    try {
        // 读取并解析 JSON 文件
        const fileContent = readFileSync(tableFilePath, 'utf-8');
        const fields = JSON.parse(fileContent);

        // 验证是否为对象
        if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
            throw new Error(`表定义文件格式错误: ${tableFilePath}`);
        }

        return fields;
    } catch (error: any) {
        throw new Error(`加载表定义失败 (${tableName}): ${error.message}`);
    }
}

/**
 * 从表定义中选择部分字段
 * @param tableName - 表名
 * @param fieldNames - 要选择的字段名数组
 * @param options - 可选配置
 * @returns 选择的字段定义对象
 */
export function pickTableFields(
    tableName: string,
    fieldNames: string[],
    options?: {
        source?: 'core' | 'project' | 'addon';
        addonName?: string;
    }
): Record<string, string> {
    const allFields = loadTableFields(tableName, options);
    const pickedFields: Record<string, string> = {};

    for (const fieldName of fieldNames) {
        if (fieldName in allFields) {
            pickedFields[fieldName] = allFields[fieldName];
        } else {
            throw new Error(`表 ${tableName} 中不存在字段: ${fieldName}`);
        }
    }

    return pickedFields;
}
