/**
 * Befly 对象操作工具
 * 提供对象和数组的处理功能
 */

import { isType } from './typeHelper.js';

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
 * 排除指定字段和值
 * @param data - 源数据（对象或数组）
 * @param excludeKeys - 要排除的字段名数组
 * @param excludeValues - 要排除的值数组
 * @returns 排除指定字段和值后的新数据
 *
 * @example
 * omitFields({ a: 1, b: 2, c: 3 }, ['b']) // { a: 1, c: 3 }
 * omitFields({ a: 1, b: null, c: 3 }, [], [null]) // { a: 1, c: 3 }
 * omitFields([{ a: 1 }, { a: 2 }], ['a']) // [{}, {}]
 */
export const omitFields = <T = any>(data: T, excludeKeys: string[] = [], excludeValues: any[] = []): T | Partial<T> => {
    const shouldDropValue = (v: any): boolean => excludeValues.some((x) => x === v);

    const cleanObject = (obj: any): any => {
        if (!isType(obj, 'object')) return obj;
        const result: any = {};
        for (const [k, v] of Object.entries(obj)) {
            if (excludeKeys.includes(k)) continue;
            if (shouldDropValue(v)) continue;
            result[k] = v;
        }
        return result;
    };

    if (isType(data, 'array')) {
        return (data as any).filter((item: any) => !shouldDropValue(item)).map((item: any) => (isType(item, 'object') ? cleanObject(item) : item));
    }

    if (isType(data, 'object')) {
        return cleanObject(data);
    }

    return data;
};
