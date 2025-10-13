/**
 * Befly 类型判断工具
 * 提供各种类型检查和判断功能
 */

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
