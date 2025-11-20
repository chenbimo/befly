/**
 * 对象字段名转小驼峰
 * @param obj - 源对象
 * @returns 字段名转为小驼峰格式的新对象
 *
 * @example
 * keysToCamel({ user_id: 123, user_name: 'John' }) // { userId: 123, userName: 'John' }
 * keysToCamel({ created_at: 1697452800000 }) // { createdAt: 1697452800000 }
 */
export declare const keysToCamel: <T = any>(obj: Record<string, any>) => T;
