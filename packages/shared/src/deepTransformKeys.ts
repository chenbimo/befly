import { isPlainObject } from 'es-toolkit/compat';
import { camelCase, snakeCase, kebabCase, pascalCase } from 'es-toolkit/string';

/**
 * 键名转换函数类型
 */
export type KeyTransformer = (key: string) => string;

/**
 * 预设的转换方式
 * - camel: 小驼峰 user_id → userId
 * - snake: 下划线 userId → user_id
 * - kebab: 短横线 userId → user-id
 * - pascal: 大驼峰 user_id → UserId
 * - upper: 大写 userId → USERID
 * - lower: 小写 UserId → userid
 */
export type PresetTransform = 'camel' | 'snake' | 'kebab' | 'pascal' | 'upper' | 'lower';

/**
 * 转换选项
 */
export interface TransformOptions {
    /** 最大递归深度，默认 100。设置为 0 表示不限制深度（不推荐） */
    maxDepth?: number;
    /** 排除的键名列表，这些键名不会被转换 */
    excludeKeys?: string[];
}

/**
 * 深度递归遍历数据结构，转换所有键名
 * 支持嵌套对象和数组，自动防止循环引用和栈溢出
 *
 * @param data - 源数据（对象、数组或其他类型）
 * @param transformer - 转换函数或预设方式
 * @param options - 转换选项
 * @returns 键名转换后的新数据
 *
 * @example
 * // 小驼峰
 * deepTransformKeys({ user_id: 123, user_info: { first_name: 'John' } }, 'camel')
 * // { userId: 123, userInfo: { firstName: 'John' } }
 *
 * @example
 * // 下划线
 * deepTransformKeys({ userId: 123, userInfo: { firstName: 'John' } }, 'snake')
 * // { user_id: 123, user_info: { first_name: 'John' } }
 *
 * @example
 * // 短横线
 * deepTransformKeys({ userId: 123, userInfo: { firstName: 'John' } }, 'kebab')
 * // { 'user-id': 123, 'user-info': { 'first-name': 'John' } }
 *
 * @example
 * // 大驼峰
 * deepTransformKeys({ user_id: 123 }, 'pascal')
 * // { UserId: 123 }
 *
 * @example
 * // 大写
 * deepTransformKeys({ userId: 123 }, 'upper')
 * // { USERID: 123 }
 *
 * @example
 * // 小写
 * deepTransformKeys({ UserId: 123 }, 'lower')
 * // { userid: 123 }
 *
 * @example
 * // 自定义转换函数
 * deepTransformKeys({ user_id: 123 }, (key) => `prefix_${key}`)
 * // { prefix_user_id: 123 }
 *
 * @example
 * // 限制递归深度
 * deepTransformKeys(deepData, 'camel', { maxDepth: 10 })
 *
 * @example
 * // 排除特定键名
 * deepTransformKeys({ _id: '123', user_name: 'John' }, 'camel', { excludeKeys: ['_id'] })
 * // { _id: '123', userName: 'John' }
 *
 * @example
 * // 嵌套数组和对象
 * deepTransformKeys({
 *   user_list: [{ user_id: 1, user_tags: [{ tag_name: 'vip' }] }]
 * }, 'camel')
 * // { userList: [{ userId: 1, userTags: [{ tagName: 'vip' }] }] }
 */
export const deepTransformKeys = <T = any>(data: any, transformer: KeyTransformer | PresetTransform, options: TransformOptions = {}): T => {
    const { maxDepth = 100, excludeKeys = [] } = options;

    // 获取实际的转换函数
    let transformFn: KeyTransformer;
    if (typeof transformer === 'function') {
        transformFn = transformer;
    } else if (transformer === 'camel') {
        transformFn = camelCase;
    } else if (transformer === 'snake') {
        transformFn = snakeCase;
    } else if (transformer === 'kebab') {
        transformFn = kebabCase;
    } else if (transformer === 'pascal') {
        transformFn = pascalCase;
    } else if (transformer === 'upper') {
        transformFn = (key: string) => key.toUpperCase();
    } else {
        transformFn = (key: string) => key.toLowerCase();
    }

    // 用于检测循环引用的 WeakSet
    const visited = new WeakSet();

    // 创建排除键名集合，提升查找性能
    const excludeSet = new Set(excludeKeys);

    // 递归转换函数
    const transform = (value: any, depth: number): any => {
        // 处理 null 和 undefined
        if (value === null || value === undefined) {
            return value;
        }

        // 处理数组
        if (Array.isArray(value)) {
            // 检测循环引用
            if (visited.has(value)) {
                return value;
            }
            visited.add(value);

            // 检查深度限制：如果达到限制，返回原数组
            if (maxDepth > 0 && depth >= maxDepth) {
                visited.delete(value);
                return value;
            }

            const result = value.map((item: any) => transform(item, depth + 1));
            visited.delete(value);
            return result;
        }

        // 处理对象
        if (isPlainObject(value)) {
            // 检测循环引用
            if (visited.has(value)) {
                return value;
            }
            visited.add(value);

            // 检查深度限制：如果达到限制，返回原对象
            if (maxDepth > 0 && depth >= maxDepth) {
                visited.delete(value);
                return value;
            }

            const result: any = {};
            for (const [key, val] of Object.entries(value)) {
                // 检查是否在排除列表中
                const transformedKey = excludeSet.has(key) ? key : transformFn(key);
                result[transformedKey] = transform(val, depth + 1);
            }
            visited.delete(value);
            return result;
        }

        // 其他类型（字符串、数字、布尔值等）直接返回
        return value;
    };

    return transform(data, 0) as T;
};
