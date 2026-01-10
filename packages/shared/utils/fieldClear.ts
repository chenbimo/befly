export interface FieldClearOptions {
    pickKeys?: string[];
    omitKeys?: string[];
    keepValues?: unknown[];
    excludeValues?: unknown[];
    keepMap?: Record<string, unknown>;
}

export type FieldClearResult<T> = T extends Array<infer U> ? Array<FieldClearResult<U>> : T extends object ? { [K in keyof T]?: T[K] } : T;

function isObject(val: unknown): val is Record<string, unknown> {
    return val !== null && typeof val === "object" && !Array.isArray(val);
}

function isArray(val: unknown): val is unknown[] {
    return Array.isArray(val);
}

export function fieldClear<T = unknown>(data: T | T[], options: FieldClearOptions = {}): FieldClearResult<T> {
    const pickKeys = options.pickKeys;
    const omitKeys = options.omitKeys;
    const keepValues = options.keepValues;
    const excludeValues = options.excludeValues;
    const keepMap = options.keepMap;

    const filterObj = (obj: Record<string, unknown>) => {
        const result: Record<string, unknown> = {};

        let keys = Object.keys(obj);
        if (pickKeys && pickKeys.length) {
            keys = keys.filter((k) => pickKeys.includes(k));
        }
        if (omitKeys && omitKeys.length) {
            keys = keys.filter((k) => !omitKeys.includes(k));
        }

        for (const key of keys) {
            const value = obj[key];

            // 1. keepMap 优先
            if (keepMap && Object.hasOwn(keepMap, key)) {
                if (Object.is(keepMap[key], value)) {
                    result[key] = value;
                    continue;
                }
            }

            // 2. keepValues
            if (keepValues && keepValues.length && !keepValues.includes(value)) {
                continue;
            }

            // 3. excludeValues
            if (excludeValues && excludeValues.length && excludeValues.includes(value)) {
                continue;
            }

            result[key] = value;
        }

        return result;
    };

    if (isArray(data)) {
        return (data as unknown[])
            .map((item) => {
                if (isObject(item)) {
                    return filterObj(item);
                }
                return item;
            })
            .filter((item) => {
                if (isObject(item)) {
                    return Object.keys(item).length > 0;
                }
                return true;
            }) as FieldClearResult<T>;
    }

    if (isObject(data)) {
        return filterObj(data as Record<string, unknown>) as FieldClearResult<T>;
    }

    return data as FieldClearResult<T>;
}
