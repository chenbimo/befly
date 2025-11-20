// fieldClear 工具函数实现
// 支持 pick/omit/keepValues/excludeValues，处理对象和数组
function isObject(val) {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
}
function isArray(val) {
    return Array.isArray(val);
}
export function fieldClear(data, options = {}) {
    const { pickKeys, omitKeys, keepValues, excludeValues } = options;
    const filterObj = (obj) => {
        let result = {};
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
        return data
            .map((item) => (isObject(item) ? filterObj(item) : item))
            .filter((item) => {
            if (isObject(item)) {
                // 只保留有内容的对象
                return Object.keys(item).length > 0;
            }
            // 原始值直接保留
            return true;
        });
    }
    if (isObject(data)) {
        return filterObj(data);
    }
    return data;
}
