/**
 * Befly 通用工具函数
 *
 * 本文件整合了所有通用工具函数的实现：
 * - API 响应工具（Yes, No）
 * - 环境判断（isDebug）
 * - 类型判断（isType, isEmptyObject, isEmptyArray）
 * - 对象操作（pickFields）
 * - 字段清理（fieldClear）
 * - 数据清洗（cleanData）
 * - 日期时间（formatDate, calcPerfTime）
 * - 字段转换（toSnakeCase, toCamelCase, keysToSnake, keysToCamel, arrayKeysToCamel, convertBigIntFields, whereKeysToSnake）
 * - Bun 版本检查（checkBunVersion）
 */

import type { KeyValue } from '../types/common.js';
import { Logger } from './logger.js';

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
// 字段转换工具
// ========================================

/**
 * 小驼峰转下划线
 * @param str - 小驼峰格式字符串
 * @returns 下划线字符串
 *
 * @example
 * toSnakeCase('userId') // 'user_id'
 * toSnakeCase('createdAt') // 'created_at'
 * toSnakeCase('userName') // 'user_name'
 * toSnakeCase('APIKey') // 'a_p_i_key'
 * toSnakeCase('HTTPRequest') // 'h_t_t_p_request'
 * toSnakeCase('XMLParser') // 'x_m_l_parser'
 */
export const toSnakeCase = (str: string): string => {
    if (!str || typeof str !== 'string') return str;

    let result = '';
    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        // 当前字符是大写字母
        if (char >= 'A' && char <= 'Z') {
            // 如果不是第一个字符，则需要在大写字母前添加下划线
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
 * Where 条件键名转下划线格式（递归处理嵌套）
 * 支持操作符字段（如 userId$gt）和逻辑操作符（$or, $and）
 *
 * @param where - 查询条件对象
 * @returns 字段名转为下划线格式的新条件对象
 *
 * @example
 * // 简单条件
 * whereKeysToSnake({ userId: 123, userName: 'John' })
 * // { user_id: 123, user_name: 'John' }
 *
 * // 带操作符
 * whereKeysToSnake({ userId$gt: 100, userName$like: '%John%' })
 * // { user_id$gt: 100, user_name$like: '%John%' }
 *
 * // 逻辑操作符
 * whereKeysToSnake({ $or: [{ userId: 1 }, { userName: 'John' }] })
 * // { $or: [{ user_id: 1 }, { user_name: 'John' }] }
 *
 * // 嵌套对象
 * whereKeysToSnake({ userId: { $gt: 100, $lt: 200 } })
 * // { user_id: { $gt: 100, $lt: 200 } }
 */
export const whereKeysToSnake = (where: any): any => {
    if (!where || typeof where !== 'object') return where;

    // 处理数组（$or, $and 等）
    if (Array.isArray(where)) {
        return where.map((item) => whereKeysToSnake(item));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(where)) {
        // 保留 $or, $and 等逻辑操作符
        if (key === '$or' || key === '$and') {
            result[key] = (value as any[]).map((item) => whereKeysToSnake(item));
            continue;
        }

        // 处理带操作符的字段名（如 userId$gt）
        if (key.includes('$')) {
            const lastDollarIndex = key.lastIndexOf('$');
            const fieldName = key.substring(0, lastDollarIndex);
            const operator = key.substring(lastDollarIndex);
            const snakeKey = toSnakeCase(fieldName) + operator;
            result[snakeKey] = value;
            continue;
        }

        // 普通字段：转换键名，递归处理值（支持嵌套对象）
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
 * 当 bigint: false 时，Bun SQL 会将大于 u32 的 BIGINT 返回为字符串，此函数将其转换为 number
 *
 * 转换规则：
 * 1. 白名单中的字段会被转换
 * 2. 所有以 'Id' 或 '_id' 结尾的字段会被自动转换
 * 3. 所有以 'At' 或 '_at' 结尾的字段会被自动转换（时间戳字段）
 * 4. 其他字段保持不变
 *
 * @param arr - 数据数组
 * @param fields - 额外需要转换的字段名数组（默认：['id', 'pid', 'sort']）
 * @returns 转换后的数组
 *
 * @example
 * // 基础字段 + 自动匹配以 Id/At 结尾的字段
 * convertBigIntFields([
 *   {
 *     id: '1760695696283001',      // ✅ 转换（在白名单）
 *     pid: '0',                     // ✅ 转换（在白名单）
 *     categoryId: '123',            // ✅ 转换（以 Id 结尾）
 *     user_id: '456',               // ✅ 转换（以 _id 结尾）
 *     createdAt: '1697452800000',  // ✅ 转换（以 At 结尾）
 *     created_at: '1697452800000', // ✅ 转换（以 _at 结尾）
 *     phone: '13800138000',         // ❌ 不转换（不匹配规则）
 *     name: 'test'                  // ❌ 不转换（不匹配规则）
 *   }
 * ])
 * // [{ id: 1760695696283001, pid: 0, categoryId: 123, user_id: 456, createdAt: 1697452800000, created_at: 1697452800000, phone: '13800138000', name: 'test' }]
 */
export const convertBigIntFields = <T = any>(arr: Record<string, any>[], fields: string[] = ['id', 'pid', 'sort']): T[] => {
    if (!arr || !isType(arr, 'array')) return arr as T[];

    return arr.map((item) => {
        const converted = { ...item };

        // 遍历对象的所有字段
        for (const [key, value] of Object.entries(converted)) {
            // 跳过 undefined 和 null
            if (value === undefined || value === null) {
                continue;
            }

            // 判断是否需要转换：
            // 1. 在白名单中
            // 2. 以 'Id' 结尾（如 userId, roleId, categoryId）
            // 3. 以 '_id' 结尾（如 user_id, role_id）
            // 4. 以 'At' 结尾（如 createdAt, updatedAt）
            // 5. 以 '_at' 结尾（如 created_at, updated_at）
            const shouldConvert = fields.includes(key) || key.endsWith('Id') || key.endsWith('_id') || key.endsWith('At') || key.endsWith('_at');

            if (shouldConvert && typeof value === 'string') {
                const num = Number(value);
                if (!isNaN(num)) {
                    converted[key] = num;
                }
            }
            // number 类型保持不变（小于 u32 的值）
        }

        return converted as T;
    }) as T[];
};

// ========================================
// Bun 版本检查
// ========================================

const REQUIRED_BUN_VERSION = '1.3.0';

/**
 * 比较版本号
 * @returns 1: v1 > v2, 0: v1 === v2, -1: v1 < v2
 */
function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;

        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }

    return 0;
}

/**
 * 获取 Bun 版本
 */
function getBunVersion(): string | null {
    try {
        // 使用 Bun.version 获取当前运行的 Bun 版本
        if (typeof Bun !== 'undefined' && Bun.version) {
            return Bun.version;
        }

        // 备用方案：执行 bun --version
        const proc = Bun.spawnSync(['bun', '--version'], {
            stdout: 'pipe',
            stderr: 'pipe'
        });

        if (proc.exitCode === 0) {
            const version = proc.stdout.toString().trim();
            return version;
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * 检查 Bun 是否安装以及版本是否满足要求
 */
export function checkBunVersion(): void {
    const currentVersion = getBunVersion();

    if (!currentVersion) {
        Logger.error('未检测到 Bun 运行时');
        Logger.info('\nBefly CLI 需要 Bun v1.3.0 或更高版本');
        Logger.info('请访问 https://bun.sh 安装 Bun\n');
        Logger.info('安装命令:');
        Logger.info('  Windows (PowerShell): powershell -c "irm bun.sh/install.ps1 | iex"');
        Logger.info('  macOS/Linux: curl -fsSL https://bun.sh/install | bash\n');
        process.exit(1);
    }

    const comparison = compareVersions(currentVersion, REQUIRED_BUN_VERSION);

    if (comparison < 0) {
        Logger.error(`Bun 版本过低: ${currentVersion}`);
        Logger.info(`\n需要 Bun v${REQUIRED_BUN_VERSION} 或更高版本`);
        Logger.info('请升级 Bun:\n');
        Logger.info('  bun upgrade\n');
        process.exit(1);
    }

    // 版本满足要求，静默通过
}
