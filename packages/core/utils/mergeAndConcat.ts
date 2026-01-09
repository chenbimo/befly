import { isPlainObject } from "./util";

function cloneDeepLoose(value: unknown): unknown {
    if (Array.isArray(value)) {
        const arr: unknown[] = [];
        for (const item of value) {
            arr.push(cloneDeepLoose(item));
        }
        return arr;
    }

    if (isPlainObject(value)) {
        const out: Record<string, unknown> = {};
        const record = value as Record<string, unknown>;
        for (const key of Object.keys(record)) {
            out[key] = cloneDeepLoose(record[key]);
        }
        return out;
    }

    return value;
}

function mergeInto(target: unknown, source: unknown): unknown {
    if (source === undefined) {
        return target;
    }

    if (Array.isArray(target) && Array.isArray(source)) {
        const nextArr: unknown[] = [];
        for (const item of target) {
            nextArr.push(cloneDeepLoose(item));
        }
        for (const item of source) {
            nextArr.push(cloneDeepLoose(item));
        }
        return nextArr;
    }

    if (isPlainObject(target) && isPlainObject(source)) {
        const targetRecord = target as Record<string, unknown>;
        const sourceRecord = source as Record<string, unknown>;

        const out: Record<string, unknown> = {};

        for (const key of Object.keys(targetRecord)) {
            out[key] = cloneDeepLoose(targetRecord[key]);
        }

        for (const key of Object.keys(sourceRecord)) {
            const srcVal = sourceRecord[key];
            if (srcVal === undefined) {
                continue;
            }

            const curVal = out[key];

            if (Array.isArray(curVal) && Array.isArray(srcVal)) {
                const nextArr: unknown[] = [];
                for (const item of curVal) {
                    nextArr.push(cloneDeepLoose(item));
                }
                for (const item of srcVal) {
                    nextArr.push(cloneDeepLoose(item));
                }
                out[key] = nextArr;
                continue;
            }

            if (isPlainObject(curVal) && isPlainObject(srcVal)) {
                out[key] = mergeInto(cloneDeepLoose(curVal), srcVal);
                continue;
            }

            out[key] = cloneDeepLoose(srcVal);
        }

        return out;
    }

    return cloneDeepLoose(source);
}

/**
 * 深度合并对象，并对数组执行 concat（保持 scanConfig 现有语义）。
 * - undefined 会被忽略
 * - plain object 深合并
 * - array 与 array 合并为新数组（保持输入不被污染）
 */
export function mergeAndConcat<T>(...items: unknown[]): T;
export function mergeAndConcat(...items: unknown[]): unknown {
    let acc: unknown = {};

    for (const item of items) {
        if (item === undefined) {
            continue;
        }

        acc = mergeInto(acc, item);
    }

    return acc;
}
