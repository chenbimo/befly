/**
 * @typedef {Object} FieldClearOptions
 * @property {string[]=} pickKeys
 * @property {string[]=} omitKeys
 * @property {any[]=} keepValues
 * @property {any[]=} excludeValues
 * @property {Record<string, any>=} keepMap
 */

function isObject(val) {
    return val !== null && typeof val === "object" && !Array.isArray(val);
}

function isArray(val) {
    return Array.isArray(val);
}

/**
 * 清理对象/数组字段
 * - 支持 pick/omit/keepValues/excludeValues
 * - 支持 keepMap 强制保留
 * @template T
 * @param {T|T[]} data
 * @param {FieldClearOptions=} options
 * @returns {any}
 */
export function fieldClear(data, options = {}) {
    const pickKeys = options.pickKeys;
    const omitKeys = options.omitKeys;
    const keepValues = options.keepValues;
    const excludeValues = options.excludeValues;
    const keepMap = options.keepMap;

    const filterObj = (obj) => {
        /** @type {Record<string, any>} */
        const result = {};

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
            if (keepMap && Object.prototype.hasOwnProperty.call(keepMap, key)) {
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
        return data
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
            });
    }

    if (isObject(data)) {
        return filterObj(data);
    }

    return data;
}
