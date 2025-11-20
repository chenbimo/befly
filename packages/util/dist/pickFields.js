import { isPlainObject } from 'es-toolkit/compat';
/**
 * 挑选指定字段
 */
export const pickFields = (obj, keys) => {
    if (!obj || (!isPlainObject(obj) && !Array.isArray(obj))) {
        return {};
    }
    const result = {};
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
};
