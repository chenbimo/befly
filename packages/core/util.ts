/**
 * Befly 核心工具函数集合
 *
 * 本文件整合了框架核心工具函数：
 * - API 响应工具（Yes, No）
 * - 类型判断（isType, isEmptyObject, isEmptyArray）
 * - 对象操作（pickFields, fieldClear, cleanData）
 * - 日期时间（formatDate, calcPerfTime）
 * - 字段转换（toSnakeCase, toCamelCase 等）
 * - 表定义工具（parseRule）
 * - Addon 管理（scanAddons, getAddonDir 等）
 * - 插件管理（sortPlugins）
 *
 * 注意：
 * - JWT 工具位于 lib/jwt.ts
 * - Logger 位于 lib/logger.ts
 * - Validator 位于 lib/validator.ts
 * - Database 管理位于 lib/database.ts
 */

import fs from 'node:fs';
import { join } from 'node:path';
import { Env } from './config/env.js';
import { Logger } from './lib/logger.js';
import { paths } from './paths.js';
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
// 环境判断工具
// ========================================

// ========================================
// 类型判断工具
// ========================================

/**
 * 类型判断
 */
export const isType = (value: any, type: string): boolean => {
    const actualType = Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
    const expectedType = String(type).toLowerCase();

    switch (expectedType) {
        case 'function':
            return typeof value === 'function';
        case 'nan':
            return typeof value === 'number' && Number.isNaN(value);
        case 'empty':
            return value === '' || value === null || value === undefined;
        case 'integer':
            return Number.isInteger(value);
        case 'float':
            return typeof value === 'number' && !Number.isInteger(value) && !Number.isNaN(value);
        case 'positive':
            return typeof value === 'number' && value > 0;
        case 'negative':
            return typeof value === 'number' && value < 0;
        case 'zero':
            return value === 0;
        case 'truthy':
            return !!value;
        case 'falsy':
            return !value;
        case 'primitive':
            return value !== Object(value);
        case 'reference':
            return value === Object(value);
        default:
            return actualType === expectedType;
    }
};

/**
 * 判断是否为空对象
 */
export const isEmptyObject = (obj: any): boolean => {
    if (!isType(obj, 'object')) {
        return false;
    }
    return Object.keys(obj).length === 0;
};

/**
 * 判断是否为空数组
 */
export const isEmptyArray = (arr: any): boolean => {
    if (!isType(arr, 'array')) {
        return false;
    }
    return arr.length === 0;
};

// ========================================
// 对象操作工具
// ========================================

/**
 * 挑选指定字段
 */
export const pickFields = <T extends Record<string, any>>(obj: T, keys: string[]): Partial<T> => {
    if (!obj || (!isType(obj, 'object') && !isType(obj, 'array'))) {
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
    if (!data || !isType(data, 'object')) {
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
// 数据清洗工具
// ========================================

/**
 * 数据清洗
 */
export const cleanData = <T = any>(data?: Record<string, any>, options: import('./types/util.js').DataCleanOptions = {}): Partial<T> => {
    const { excludeKeys = [], includeKeys = [], removeValues = [null, undefined], maxLen = 0, deep = false } = options;

    if (!data || !isType(data, 'object')) {
        return data as Partial<T>;
    }

    const result: any = {};

    const shouldRemoveValue = (value: any): boolean => {
        return removeValues.some((removeVal) => Object.is(removeVal, value));
    };

    const processValue = (value: any): any => {
        if (deep && isType(value, 'object')) {
            return cleanData(value, options);
        }

        if (deep && isType(value, 'array')) {
            return value.map((item: any) => (isType(item, 'object') ? cleanData(item, options) : item));
        }

        if (maxLen > 0) {
            if (isType(value, 'string') && value.length > maxLen) {
                return value.substring(0, maxLen);
            }

            if (!isType(value, 'string')) {
                try {
                    const strValue = JSON.stringify(value);
                    if (strValue && strValue.length > maxLen) {
                        return strValue.substring(0, maxLen);
                    }
                } catch {}
            }
        }

        return value;
    };

    for (const [key, value] of Object.entries(data)) {
        if (shouldRemoveValue(value)) {
            continue;
        }

        if (includeKeys.length > 0) {
            if (includeKeys.includes(key)) {
                result[key] = processValue(value);
            }
            continue;
        }

        if (excludeKeys.includes(key)) {
            continue;
        }

        result[key] = processValue(value);
    }

    return result;
};

// ========================================
// 日期时间工具
// ========================================

/**
 * 格式化日期
 */
export const formatDate = (date: Date | string | number = new Date(), format: string = 'YYYY-MM-DD HH:mm:ss'): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');

    return format.replace('YYYY', String(year)).replace('MM', month).replace('DD', day).replace('HH', hour).replace('mm', minute).replace('ss', second);
};

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
// 字段转换工具
// ========================================

/**
 * 小驼峰转下划线
 */
export const toSnakeCase = (str: string): string => {
    if (!str || typeof str !== 'string') return str;

    let result = '';
    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (char >= 'A' && char <= 'Z') {
            if (i > 0) {
                result += '_';
            }
            result += char.toLowerCase();
        } else {
            result += char;
        }
    }

    return result;
};

/**
 * 下划线转小驼峰
 */
export const toCamelCase = (str: string): string => {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

/**
 * 对象字段名转下划线
 */
export const keysToSnake = <T = any>(obj: Record<string, any>): T => {
    if (!obj || !isType(obj, 'object')) return obj as T;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = toSnakeCase(key);
        result[snakeKey] = value;
    }
    return result;
};

/**
 * 对象字段名转小驼峰
 */
export const keysToCamel = <T = any>(obj: Record<string, any>): T => {
    if (!obj || !isType(obj, 'object')) return obj as T;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = toCamelCase(key);
        result[camelKey] = value;
    }
    return result;
};

/**
 * 数组对象字段名批量转小驼峰
 */
export const arrayKeysToCamel = <T = any>(arr: Record<string, any>[]): T[] => {
    if (!arr || !isType(arr, 'array')) return arr as T[];
    return arr.map((item) => keysToCamel<T>(item));
};

/**
 * Where 条件键名转下划线格式
 */
export const whereKeysToSnake = (where: any): any => {
    if (!where || typeof where !== 'object') return where;

    if (Array.isArray(where)) {
        return where.map((item) => whereKeysToSnake(item));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(where)) {
        if (key === '$or' || key === '$and') {
            result[key] = (value as any[]).map((item) => whereKeysToSnake(item));
            continue;
        }

        if (key.includes('$')) {
            const lastDollarIndex = key.lastIndexOf('$');
            const fieldName = key.substring(0, lastDollarIndex);
            const operator = key.substring(lastDollarIndex);
            const snakeKey = toSnakeCase(fieldName) + operator;
            result[snakeKey] = value;
            continue;
        }

        const snakeKey = toSnakeCase(key);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            result[snakeKey] = whereKeysToSnake(value);
        } else {
            result[snakeKey] = value;
        }
    }

    return result;
};

/**
 * 转换数据库 BIGINT 字段为数字类型
 */
export const convertBigIntFields = <T = any>(arr: Record<string, any>[], fields: string[] = ['id', 'pid', 'sort']): T[] => {
    if (!arr || !isType(arr, 'array')) return arr as T[];

    return arr.map((item) => {
        const converted = { ...item };

        for (const [key, value] of Object.entries(converted)) {
            if (value === undefined || value === null) {
                continue;
            }

            const shouldConvert = fields.includes(key) || key.endsWith('Id') || key.endsWith('_id') || key.endsWith('At') || key.endsWith('_at');

            if (shouldConvert && typeof value === 'string') {
                const num = Number(value);
                if (!isNaN(num)) {
                    converted[key] = num;
                }
            }
        }

        return converted as T;
    }) as T[];
};

// ========================================
// JWT 工具类
// ========================================

// JWT 位于 lib/jwt.ts，直接从那里导入使用

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
        type: fieldType as 'string' | 'number' | 'text' | 'array',
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
    const beflyDir = join(paths.projectDir, 'node_modules', '@befly');

    if (!fs.existsSync(beflyDir)) {
        return [];
    }

    try {
        return fs
            .readdirSync(beflyDir)
            .filter((name) => {
                if (!name.startsWith('addon-')) return false;
                const fullPath = join(beflyDir, name);
                try {
                    const stat = fs.statSync(fullPath);
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
    return join(paths.projectDir, 'node_modules', '@befly', addonName, subDir);
};

/**
 * 检查 addon 子目录是否存在
 */
export const addonDirExists = (addonName: string, subDir: string): boolean => {
    const dir = getAddonDir(addonName, subDir);
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
};

// ========================================
// 插件管理工具
// ========================================

/**
 * 排序插件（根据依赖关系）
 */
export const sortPlugins = (plugins: Plugin[]): Plugin[] | false => {
    const result: Plugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const pluginMap: Record<string, Plugin> = Object.fromEntries(plugins.map((p) => [p.name, p]));
    let isPass = true;

    const visit = (name: string): void => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            isPass = false;
            return;
        }

        const plugin = pluginMap[name];
        if (!plugin) return;

        visiting.add(name);
        (plugin.dependencies || []).forEach(visit);
        visiting.delete(name);
        visited.add(name);
        result.push(plugin);
    };

    plugins.forEach((p) => visit(p.name));
    return isPass ? result : false;
};
