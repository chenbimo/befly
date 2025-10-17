/**
 * Befly 辅助工具集
 *
 * 本文件整合了所有辅助工具函数，包括：
 * - API 响应工具
 * - 环境判断工具
 * - 类型判断工具
 * - 对象操作工具
 * - 日期时间工具
 * - 命名转换工具
 * - 数据清洗工具
 * - API 定义工具
 * - Addon 管理工具
 * - Plugin 管理工具
 * - 表定义工具
 */

import fs from 'node:fs';
import { join } from 'node:path';
import { paths } from '../paths.js';
import type { ApiRoute, ApiOptions } from '../types/api.js';
import type { Plugin } from '../types/plugin.js';
import type { ParsedFieldRule, KeyValue } from '../types/common.js';

// ========================================
// API 响应工具
// ========================================

/**
 * 成功响应
 * @param msg - 响应消息
 * @param data - 响应数据
 * @param other - 其他字段
 * @returns 成功响应对象 { code: 0, msg, data, ...other }
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
 * @param msg - 错误消息
 * @param data - 错误数据
 * @param other - 其他字段
 * @returns 失败响应对象 { code: 1, msg, data, ...other }
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

/**
 * 判断是否开启调试模式
 * @returns 是否开启调试模式
 *
 * 判断逻辑：
 * 1. DEBUG=1 或 DEBUG=true 时返回 true
 * 2. development 环境下默认返回 true（除非 DEBUG=0）
 * 3. 其他情况返回 false
 *
 * @example
 * // DEBUG=1
 * isDebug() // true
 *
 * // NODE_ENV=development
 * isDebug() // true
 *
 * // NODE_ENV=development, DEBUG=0
 * isDebug() // false
 *
 * // NODE_ENV=production
 * isDebug() // false
 */
export function isDebug(): boolean {
    return process.env.DEBUG === '1' || process.env.DEBUG === 'true' || (process.env.NODE_ENV === 'development' && process.env.DEBUG !== '0');
}

// ========================================
// 类型判断工具
// ========================================

/**
 * 类型判断
 * @param value - 要判断的值
 * @param type - 期望的类型
 * @returns 是否匹配指定类型
 *
 * @example
 * isType(123, 'number') // true
 * isType('hello', 'string') // true
 * isType([], 'array') // true
 * isType({}, 'object') // true
 * isType(null, 'null') // true
 * isType(undefined, 'undefined') // true
 * isType(NaN, 'nan') // true
 * isType(42, 'integer') // true
 * isType(3.14, 'float') // true
 * isType(10, 'positive') // true
 * isType(-5, 'negative') // true
 * isType(0, 'zero') // true
 * isType('', 'empty') // true
 * isType(null, 'empty') // true
 * isType(true, 'truthy') // true
 * isType(false, 'falsy') // true
 * isType('str', 'primitive') // true
 * isType({}, 'reference') // true
 */
export const isType = (value: any, type: string): boolean => {
    const actualType = Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
    const expectedType = String(type).toLowerCase();

    // 语义类型单独处理
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
 * @param obj - 要判断的值
 * @returns 是否为空对象
 *
 * @example
 * isEmptyObject({}) // true
 * isEmptyObject({ a: 1 }) // false
 * isEmptyObject([]) // false
 * isEmptyObject(null) // false
 */
export const isEmptyObject = (obj: any): boolean => {
    if (!isType(obj, 'object')) {
        return false;
    }
    return Object.keys(obj).length === 0;
};

/**
 * 判断是否为空数组
 * @param arr - 要判断的值
 * @returns 是否为空数组
 *
 * @example
 * isEmptyArray([]) // true
 * isEmptyArray([1, 2]) // false
 * isEmptyArray({}) // false
 * isEmptyArray(null) // false
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
 * @param obj - 源对象
 * @param keys - 要挑选的字段名数组
 * @returns 包含指定字段的新对象
 *
 * @example
 * pickFields({ a: 1, b: 2, c: 3 }, ['a', 'c']) // { a: 1, c: 3 }
 * pickFields({ name: 'John', age: 30 }, ['name']) // { name: 'John' }
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
 * 字段清理 - 排除指定值，保留特定字段的特定值
 * @param data - 源数据对象（只接受对象类型）
 * @param excludeValues - 要排除的值数组
 * @param keepValues - 要保留的字段值对象（字段名: 值）
 * @returns 清理后的新对象
 *
 * @example
 * // 排除指定值
 * fieldClear({ a: 1, b: null, c: 3, d: undefined }, [null, undefined], {})
 * // { a: 1, c: 3 }
 *
 * // 保留指定字段的特定值
 * fieldClear({ category: '', name: 'John', recordId: 0, age: 30 }, [null, undefined, '', 0], { category: '', recordId: 0 })
 * // { category: '', name: 'John', recordId: 0, age: 30 }
 *
 * // 排除空字符串和0，但保留特定字段的这些值
 * fieldClear({ a: '', b: 'text', c: 0, d: 5 }, ['', 0], { a: '', c: 0 })
 * // { a: '', b: 'text', c: 0, d: 5 }
 *
 * // 默认排除 null 和 undefined
 * fieldClear({ a: 1, b: null, c: undefined, d: 2 }, [null, undefined], {})
 * // { a: 1, d: 2 }
 */
export const fieldClear = <T extends Record<string, any> = any>(data: T, excludeValues: any[] = [null, undefined], keepValues: Record<string, any> = {}): Partial<T> => {
    // 只接受对象类型
    if (!data || !isType(data, 'object')) {
        return {};
    }

    const result: any = {};

    for (const [key, value] of Object.entries(data)) {
        // 检查是否在 keepValues 中（保留特定字段的特定值，优先级最高）
        if (key in keepValues) {
            // 使用 Object.is 严格比较（处理 NaN、0、-0 等特殊值）
            if (Object.is(keepValues[key], value)) {
                result[key] = value;
                continue;
            }
        }

        // 排除指定值
        const shouldExclude = excludeValues.some((excludeVal) => Object.is(excludeVal, value));
        if (shouldExclude) {
            continue;
        }

        // 保留其他字段
        result[key] = value;
    }

    return result;
};

// ========================================
// 日期时间工具
// ========================================

/**
 * 格式化日期
 * @param date - 日期对象、时间戳或日期字符串
 * @param format - 格式化模板（支持 YYYY, MM, DD, HH, mm, ss）
 * @returns 格式化后的日期字符串
 *
 * @example
 * formatDate(new Date('2025-10-11 15:30:45')) // '2025-10-11 15:30:45'
 * formatDate(new Date('2025-10-11'), 'YYYY-MM-DD') // '2025-10-11'
 * formatDate(1728648645000, 'YYYY/MM/DD HH:mm') // '2025/10/11 15:30'
 * formatDate('2025-10-11', 'MM-DD') // '10-11'
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
 * 用于测量代码执行时间（使用 Bun.nanoseconds()）
 * @param startTime - 开始时间（Bun.nanoseconds()返回值）
 * @param endTime - 结束时间（可选，默认为当前时间）
 * @returns 时间差（毫秒或秒）
 *
 * @example
 * const start = Bun.nanoseconds();
 * // ... 执行代码 ...
 * const elapsed = calcPerfTime(start); // '15.23 毫秒' 或 '2.45 秒'
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
// 命名转换工具
// ========================================

/**
 * 小驼峰转下划线（蛇形命名）
 * 支持处理连续大写字母（如 APIKey -> api_key）
 * @param str - 小驼峰字符串
 * @returns 下划线格式字符串
 *
 * @example
 * toSnakeCase('userId') // 'user_id'
 * toSnakeCase('createdAt') // 'created_at'
 * toSnakeCase('userName') // 'user_name'
 * toSnakeCase('APIKey') // 'api_key'
 * toSnakeCase('HTTPResponse') // 'http_response'
 * toSnakeCase('XMLParser') // 'xml_parser'
 */
export const toSnakeCase = (str: string): string => {
    if (!str || typeof str !== 'string') return str;
    return String(str)
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1_$2')
        .toLowerCase();
};

/**
 * 下划线转小驼峰
 * @param str - 下划线格式字符串
 * @returns 小驼峰字符串
 *
 * @example
 * toCamelCase('user_id') // 'userId'
 * toCamelCase('created_at') // 'createdAt'
 * toCamelCase('user_name') // 'userName'
 */
export const toCamelCase = (str: string): string => {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

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
 * @param obj - 源对象
 * @returns 字段名转为小驼峰格式的新对象
 *
 * @example
 * keysToCamel({ user_id: 123, user_name: 'John' }) // { userId: 123, userName: 'John' }
 * keysToCamel({ created_at: 1697452800000 }) // { createdAt: 1697452800000 }
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
    if (!arr || !isType(arr, 'array')) return arr as T[];
    return arr.map((item) => keysToCamel<T>(item));
};

/**
 * Where 条件字段名转下划线（递归处理嵌套结构）
 * @param where - Where 条件对象
 * @returns 字段名转为下划线格式的新对象
 *
 * @example
 * whereKeysToSnake({ userId: 123 }) // { user_id: 123 }
 * whereKeysToSnake({ userId$gt: 100 }) // { user_id$gt: 100 }
 * whereKeysToSnake({ $or: [{ userId: 1 }, { userName: 'John' }] })
 * // { $or: [{ user_id: 1 }, { user_name: 'John' }] }
 */
export const whereKeysToSnake = (where: any): any => {
    if (!where || !isType(where, 'object')) return where;

    const result: any = {};

    for (const [key, value] of Object.entries(where)) {
        // 处理 $or、$and 等逻辑操作符
        if (key === '$or' || key === '$and') {
            if (isType(value, 'array')) {
                result[key] = (value as any[]).map((item) => whereKeysToSnake(item));
            } else {
                result[key] = value;
            }
            continue;
        }

        // 处理字段名（包含操作符的情况，如 'userId$gt'）
        if (key.includes('$')) {
            // 分离字段名和操作符
            const [fieldName, ...operators] = key.split('$');
            const snakeField = toSnakeCase(fieldName);
            const newKey = operators.length > 0 ? `${snakeField}$${operators.join('$')}` : snakeField;
            result[newKey] = value;
        } else {
            // 普通字段名
            const snakeKey = toSnakeCase(key);
            // 如果值是对象（嵌套的操作符对象），递归处理
            if (isType(value, 'object') && !isType(value, 'array')) {
                result[snakeKey] = whereKeysToSnake(value);
            } else {
                result[snakeKey] = value;
            }
        }
    }

    return result;
};

// ========================================
// 数据清洗工具
// ========================================

/**
 * 数据清洗选项
 */
export interface DataCleanOptions {
    /** 要排除的字段名数组 */
    excludeKeys?: string[];
    /** 只包含的字段名数组（优先级高于 excludeKeys） */
    includeKeys?: string[];
    /** 要移除的值数组 */
    removeValues?: any[];
    /** 字段值最大长度（超过会截断） */
    maxLen?: number;
    /** 是否深度清洗（处理嵌套对象） */
    deep?: boolean;
}

/**
 * 数据清洗 - 清理和过滤对象数据
 * @param data - 源数据对象
 * @param options - 清洗选项
 * @returns 清洗后的新对象
 *
 * @example
 * // 排除指定字段
 * cleanData({ a: 1, b: 2, c: 3 }, { excludeKeys: ['b'] })
 * // { a: 1, c: 3 }
 *
 * // 只包含指定字段
 * cleanData({ a: 1, b: 2, c: 3 }, { includeKeys: ['a', 'c'] })
 * // { a: 1, c: 3 }
 *
 * // 移除指定值
 * cleanData({ a: 1, b: null, c: undefined, d: '' }, { removeValues: [null, undefined, ''] })
 * // { a: 1 }
 *
 * // 限制字段值长度
 * cleanData({ name: 'A'.repeat(1000) }, { maxLen: 100 })
 * // { name: 'AAA...AAA' (100个字符) }
 *
 * // 组合使用
 * cleanData(
 *   { a: 1, b: null, c: 'very long text...', d: 4 },
 *   { excludeKeys: ['d'], removeValues: [null], maxLen: 10 }
 * )
 * // { a: 1, c: 'very long ' }
 *
 * // 深度清洗嵌套对象
 * cleanData(
 *   { user: { name: 'John', password: '123', nested: { secret: 'xxx' } } },
 *   { excludeKeys: ['password', 'secret'], deep: true }
 * )
 * // { user: { name: 'John', nested: {} } }
 */
export const cleanData = <T = any>(data?: Record<string, any>, options: DataCleanOptions = {}): Partial<T> => {
    // 参数默认值
    const { excludeKeys = [], includeKeys = [], removeValues = [null, undefined], maxLen = 0, deep = false } = options;

    // 非对象直接返回（不做任何处理）
    if (!data || !isType(data, 'object')) {
        return data as Partial<T>;
    }

    const result: any = {};

    // 判断值是否应该被移除
    const shouldRemoveValue = (value: any): boolean => {
        return removeValues.some((removeVal) => {
            // 使用 Object.is 进行严格比较（处理 NaN、0、-0 等特殊值）
            return Object.is(removeVal, value);
        });
    };

    // 处理字段值（截断、深度清洗）
    const processValue = (value: any): any => {
        // 深度清洗嵌套对象
        if (deep && isType(value, 'object')) {
            return cleanData(value, options);
        }

        // 深度清洗数组对象
        if (deep && isType(value, 'array')) {
            return value.map((item: any) => (isType(item, 'object') ? cleanData(item, options) : item));
        }

        // 字段值长度限制
        if (maxLen > 0) {
            // 字符串直接截断
            if (isType(value, 'string') && value.length > maxLen) {
                return value.substring(0, maxLen);
            }

            // 非字符串先转字符串再截断
            if (!isType(value, 'string')) {
                try {
                    const strValue = JSON.stringify(value);
                    if (strValue && strValue.length > maxLen) {
                        return strValue.substring(0, maxLen);
                    }
                } catch {
                    // JSON.stringify 失败则返回原值
                }
            }
        }

        return value;
    };

    // 遍历对象字段
    for (const [key, value] of Object.entries(data)) {
        // 排除指定值
        if (shouldRemoveValue(value)) {
            continue;
        }

        // includeKeys 优先级最高
        if (includeKeys.length > 0) {
            if (includeKeys.includes(key)) {
                result[key] = processValue(value);
            }
            continue;
        }

        // 排除指定字段
        if (excludeKeys.includes(key)) {
            continue;
        }

        // 保留字段并处理值
        result[key] = processValue(value);
    }

    return result;
};

// ========================================
// API 定义工具
// ========================================

/**
 * 定义 API 路由（主函数）
 * @param name - 接口名称
 * @param options - 接口配置选项
 * @returns API 路由定义
 */
export function Api(name: string, options: ApiOptions): ApiRoute {
    return {
        method: options.method || 'POST',
        name: name,
        auth: options.auth ?? false,
        fields: options.fields ?? {},
        required: options.required ?? [],
        handler: async (befly, ctx, req) => await options.handler(befly, ctx, req)
    };
}

// ========================================
// Addon 管理工具
// ========================================

/**
 * 扫描所有可用的 addon
 * @returns addon 名称数组（过滤掉 _ 开头的目录）
 */
export const scanAddons = (): string[] => {
    if (!fs.existsSync(paths.projectAddonDir)) {
        return [];
    }

    try {
        return fs
            .readdirSync(paths.projectAddonDir)
            .filter((name) => {
                const fullPath = join(paths.projectAddonDir, name);
                const stat = fs.statSync(fullPath);
                const isDir = stat.isDirectory();
                const notSkip = !name.startsWith('_'); // 跳过 _ 开头的目录
                return isDir && notSkip;
            })
            .sort(); // 按字母顺序排序
    } catch (error) {
        return [];
    }
};

/**
 * 获取 addon 的指定子目录路径
 * @param addonName - addon 名称
 * @param subDir - 子目录名称（apis, checks, plugins, tables, types, config）
 */
export const getAddonDir = (addonName: string, subDir: string): string => {
    return join(paths.projectAddonDir, addonName, subDir);
};

/**
 * 检查 addon 子目录是否存在
 * @param addonName - addon 名称
 * @param subDir - 子目录名称
 */
export const addonDirExists = (addonName: string, subDir: string): boolean => {
    const dir = getAddonDir(addonName, subDir);
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
};

// ========================================
// Plugin 管理工具
// ========================================

/**
 * 排序插件（根据依赖关系）
 * 使用拓扑排序算法，确保依赖的插件先加载
 *
 * @param plugins - 插件数组
 * @returns 排序后的插件数组，如果存在循环依赖则返回 false
 *
 * @example
 * const plugins = [
 *   { name: 'logger', dependencies: [] },
 *   { name: 'db', dependencies: ['logger'] },
 *   { name: 'api', dependencies: ['db', 'logger'] }
 * ];
 *
 * const sorted = sortPlugins(plugins);
 * // [
 * //   { name: 'logger', dependencies: [] },
 * //   { name: 'db', dependencies: ['logger'] },
 * //   { name: 'api', dependencies: ['db', 'logger'] }
 * // ]
 *
 * // 循环依赖示例
 * const badPlugins = [
 *   { name: 'a', dependencies: ['b'] },
 *   { name: 'b', dependencies: ['a'] }
 * ];
 * sortPlugins(badPlugins); // false
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
        if (!plugin) return; // 依赖不存在时跳过

        visiting.add(name);
        (plugin.dependencies || []).forEach(visit);
        visiting.delete(name);
        visited.add(name);
        result.push(plugin);
    };

    plugins.forEach((p) => visit(p.name));
    return isPass ? result : false;
};

// ========================================
// 表定义工具
// ========================================

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
