import { isPlainObject } from 'es-toolkit/compat';
import { snakeCase } from 'es-toolkit/string';
/**
 * 对象字段名转下划线
 * @param obj - 源对象
 * @returns 字段名转为下划线格式的新对象
 *
 * @example
 * keysToSnake({ userId: 123, userName: 'John' }) // { user_id: 123, user_name: 'John' }
 * keysToSnake({ createdAt: 1697452800000 }) // { created_at: 1697452800000 }
 */
export const keysToSnake = (obj) => {
    if (!obj || !isPlainObject(obj)) return obj;
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = snakeCase(key);
        result[snakeKey] = value;
    }
    return result;
};
