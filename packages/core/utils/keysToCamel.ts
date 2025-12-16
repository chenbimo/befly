import { isPlainObject } from "es-toolkit/compat";
import { camelCase } from "es-toolkit/string";

/**
 * 对象字段名转小驼峰
 * @param obj - 源对象
 * @returns 字段名转为小驼峰格式的新对象
 *
 * @example
 * keysToCamel({ user_id: 123, user_name: 'John' }) // { userId: 123, userName: 'John' }
 * keysToCamel({ created_at: 1697452800000 }) // { createdAt: 1697452800000 }
 */
export const keysToCamel = <T = any>(obj: Record<string, any>): T => {
  if (!obj || !isPlainObject(obj)) return obj as T;

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = camelCase(key);
    result[camelKey] = value;
  }
  return result;
};
