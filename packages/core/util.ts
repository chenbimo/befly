/**
 * Befly 核心工具函数集合
 *
 * 本文件整合了框架核心工具函数：
 * - API 响应工具（Yes, No）
 * - 对象操作（pickFields, fieldClear）
 * - 日期时间（calcPerfTime）
 * - 表定义工具（parseRule）
 * - Addon 管理（scanAddons, getAddonDir 等）
 *
 * 注意：
 * - JWT 工具位于 lib/jwt.ts
 * - Logger 位于 lib/logger.ts
 * - Validator 位于 lib/validator.ts
 * - Database 管理位于 lib/database.ts
 */

import fs from 'node:fs';
import { join } from 'pathe';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { isEmpty, isPlainObject } from 'es-toolkit/compat';
import { snakeCase, camelCase, kebabCase } from 'es-toolkit/string';
import { Env } from './config/env.js';
import { Logger } from './lib/logger.js';
import { projectDir } from './paths.js';
import type { KeyValue } from './types/common.js';
import type { JwtPayload, JwtSignOptions, JwtVerifyOptions } from './types/jwt';
import type { Plugin } from './types/plugin.js';
import type { ParsedFieldRule } from './types/common.js';

// ========================================
// API 响应工具
// ========================================

/**
 * 成功响应
 */
export const Yes = <T = any>(msg: string = '', data: T | {} = {}, other: KeyValue = {}): { code: 0; msg: string; data: T | {} } & KeyValue => {
    return {
        ...other,
        code: 0,
        msg: msg,
        data: data
    };
};

/**
 * 失败响应
 */
export const No = <T = any>(msg: string = '', data: T | {} = {}, other: KeyValue = {}): { code: 1; msg: string; data: T | {} } & KeyValue => {
    return {
        ...other,
        code: 1,
        msg: msg,
        data: data
    };
};

// ========================================
// 字段转换工具（重新导出 lib/convert.ts）
// ========================================

/**
 * 对象字段名转下划线
 * @param obj - 源对象
 * @returns 字段名转为下划线格式的新对象
 *
 * @example
 * keysToSnake({ userId: 123, userName: 'John' }) // { user_id: 123, user_name: 'John' }
 * keysToSnake({ createdAt: 1697452800000 }) // { created_at: 1697452800000 }
 */
export const keysToSnake = <T = any>(obj: Record<string, any>): T => {
    if (!obj || !isPlainObject(obj)) return obj as T;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = snakeCase(key);
        result[snakeKey] = value;
    }
    return result;
};

/**
 * 对象字段名转小驼峰
 * @param obj - 源对象
 * @returns 字段名转为小驼峰格式的新对象
 *
 * @example
 * keysToCamel({ user_id: 123, user_name: 'John' }) // { userId: 123, userName: 'John' }
 * keysToCamel({ created_at: 1697452800000 }) // { createdAt: 1697452800000 }
 */
export const keysToCamel = <T = any>(obj: Record<string, any>): T => {
    if (!obj || !isPlainObject(obj)) return obj as T;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = camelCase(key);
        result[camelKey] = value;
    }
    return result;
};

/**
 * 数组对象字段名批量转小驼峰
 * @param arr - 源数组
 * @returns 字段名转为小驼峰格式的新数组
 *
 * @example
 * arrayKeysToCamel([
 *   { user_id: 1, user_name: 'John' },
 *   { user_id: 2, user_name: 'Jane' }
 * ])
 * // [{ userId: 1, userName: 'John' }, { userId: 2, userName: 'Jane' }]
 */
export const arrayKeysToCamel = <T = any>(arr: Record<string, any>[]): T[] => {
    if (!arr || !Array.isArray(arr)) return arr as T[];
    return arr.map((item) => keysToCamel<T>(item));
};

// ========================================
// 对象操作工具
// ========================================

/**
 * 挑选指定字段
 */
export const pickFields = <T extends Record<string, any>>(obj: T, keys: string[]): Partial<T> => {
    if (!obj || (!isPlainObject(obj) && !Array.isArray(obj))) {
        return {};
    }

    const result: any = {};
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }

    return result;
};

/**
 * 字段清理
 */
export const fieldClear = <T extends Record<string, any> = any>(data: T, excludeValues: any[] = [null, undefined], keepValues: Record<string, any> = {}): Partial<T> => {
    if (!data || !isPlainObject(data)) {
        return {};
    }

    const result: any = {};

    for (const [key, value] of Object.entries(data)) {
        if (key in keepValues) {
            if (Object.is(keepValues[key], value)) {
                result[key] = value;
                continue;
            }
        }

        const shouldExclude = excludeValues.some((excludeVal) => Object.is(excludeVal, value));
        if (shouldExclude) {
            continue;
        }

        result[key] = value;
    }

    return result;
};

// ========================================
// 日期时间工具
// ========================================

/**
 * 计算性能时间差
 */
export const calcPerfTime = (startTime: number, endTime: number = Bun.nanoseconds()): string => {
    const elapsedMs = (endTime - startTime) / 1_000_000;

    if (elapsedMs < 1000) {
        return `${elapsedMs.toFixed(2)} 毫秒`;
    } else {
        const elapsedSeconds = elapsedMs / 1000;
        return `${elapsedSeconds.toFixed(2)} 秒`;
    }
};

// ========================================
// 表定义工具
// ========================================

/**
 * 解析字段规则字符串
 * 格式："字段名|类型|最小值|最大值|默认值|必填|正则"
 * 注意：只分割前6个|，第7个|之后的所有内容（包括|）都属于正则表达式
 */
export const parseRule = (rule: string): ParsedFieldRule => {
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
        type: fieldType as 'string' | 'number' | 'text' | 'array_string' | 'array_text',
        min: fieldMin,
        max: fieldMax,
        default: fieldDefault,
        index: fieldIndex,
        regex: fieldRegx !== 'null' ? fieldRegx : null
    };
};

// ========================================
// Addon 管理工具
// ========================================

/**
 * 扫描所有可用的 addon
 */
export const scanAddons = (): string[] => {
    const beflyDir = join(projectDir, 'node_modules', '@befly-addon');

    if (!existsSync(beflyDir)) {
        return [];
    }

    try {
        return fs
            .readdirSync(beflyDir)
            .filter((name) => {
                // addon 名称格式：admin, demo 等（不带 addon- 前缀）
                const fullPath = join(beflyDir, name);
                try {
                    const stat = statSync(fullPath);
                    return stat.isDirectory();
                } catch {
                    return false;
                }
            })
            .sort();
    } catch {
        return [];
    }
};

/**
 * 获取 addon 的指定子目录路径
 */
export const getAddonDir = (addonName: string, subDir: string): string => {
    return join(projectDir, 'node_modules', '@befly-addon', addonName, subDir);
};

/**
 * 检查 addon 子目录是否存在
 */
export const addonDirExists = (addonName: string, subDir: string): boolean => {
    const dir = getAddonDir(addonName, subDir);
    return existsSync(dir) && statSync(dir).isDirectory();
};

/**
 * 获取插件目录列表
 * @param addonsDir - addons 根目录路径
 * @returns 插件名称数组
 */
export function getAddonDirs(addonsDir: string): string[] {
    // try {
    return readdirSync(addonsDir).filter((name) => {
        const addonPath = path.join(addonsDir, name);
        return statSync(addonPath).isDirectory() && !name.startsWith('_');
    });
    // } catch (error: any) {
    //     Logger.error(`读取插件目录失败: ${addonsDir}`, error.message);
    //     return [];
    // }
}
