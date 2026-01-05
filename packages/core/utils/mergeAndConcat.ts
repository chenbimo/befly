import { isPlainObject } from "./isPlainObject";

function cloneDeepLoose(value: any): any {
    if (Array.isArray(value)) {
        const arr: any[] = [];
        for (const item of value) {
            arr.push(cloneDeepLoose(item));
        }
        return arr;
    }

    if (isPlainObject(value)) {
        const out: Record<string, any> = {};
        for (const key of Object.keys(value)) {
            out[key] = cloneDeepLoose(value[key]);
        }
        return out;
    }

    return value;
}

function mergeInto(target: any, source: any): any {
    if (source === undefined) {
        return target;
    }

    if (Array.isArray(target) && Array.isArray(source)) {
        for (const item of source) {
            target.push(cloneDeepLoose(item));
        }
        return target;
    }

    if (isPlainObject(target) && isPlainObject(source)) {
        for (const key of Object.keys(source)) {
            const srcVal = source[key];
            if (srcVal === undefined) {
                continue;
            }

            const curVal = target[key];

            if (Array.isArray(curVal) && Array.isArray(srcVal)) {
                const nextArr: any[] = [];
                for (const item of curVal) {
                    nextArr.push(cloneDeepLoose(item));
                }
                for (const item of srcVal) {
                    nextArr.push(cloneDeepLoose(item));
                }
                target[key] = nextArr;
                continue;
            }

            if (isPlainObject(curVal) && isPlainObject(srcVal)) {
                target[key] = mergeInto(cloneDeepLoose(curVal), srcVal);
                continue;
            }

            target[key] = cloneDeepLoose(srcVal);
        }
        return target;
    }

    return cloneDeepLoose(source);
}

/**
 * 深度合并对象，并对数组执行 concat（保持 scanConfig 现有语义）。
 * - undefined 会被忽略
 * - plain object 深合并
 * - array 与 array 合并为新数组（保持输入不被污染）
 */
export function mergeAndConcat(...items: any[]): any {
    let acc: any = {};

    for (const item of items) {
        if (item === undefined) {
            continue;
        }

        acc = mergeInto(acc, item);
    }

    return acc;
}
