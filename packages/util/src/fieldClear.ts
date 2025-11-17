// fieldClear 工具函数实现
// 支持 pick/omit/keepValues/excludeValues，处理对象和数组
// 类型定义在 types/fieldClear.ts

import type { FieldClearOptions, FieldClearResult } from '../types/fieldClear';

function isObject(val: unknown): val is Record<string, any> {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function isArray(val: unknown): val is any[] {
    return Array.isArray(val);
}

export function fieldClear<T = any>(data: T | T[], options: FieldClearOptions = {}): FieldClearResult<T> {
    const { pickKeys, omitKeys, keepValues, excludeValues } = options;

    const filterObj = (obj: Record<string, any>) => {
        let result: Record<string, any> = {};
        let keys = Object.keys(obj);
        if (pickKeys && pickKeys.length) {
            keys = keys.filter((k) => pickKeys.includes(k));
        }
        if (omitKeys && omitKeys.length) {
            keys = keys.filter((k) => !omitKeys.includes(k));
        }
        for (const key of keys) {
            const value = obj[key];
            if (keepValues && keepValues.length && !keepValues.includes(value)) {
                continue;
            }
            if (excludeValues && excludeValues.length && excludeValues.includes(value)) {
                continue;
            }
            result[key] = value;
        }
        return result;
    };

    if (isArray(data)) {
        return (data as any[])
            .map((item) => (isObject(item) ? filterObj(item) : item))
            .filter((item) => {
                if (isObject(item)) {
                    // 只保留有内容的对象
                    return Object.keys(item).length > 0;
                }
                // 原始值直接保留
                return true;
            }) as FieldClearResult<T>;
    }
    if (isObject(data)) {
        return filterObj(data as Record<string, any>) as FieldClearResult<T>;
    }
    return data as FieldClearResult<T>;
}
