/**
 * 数据转换工具
 *
 * 提供命名格式转换、对象字段转换、BigInt 字段转换等功能
 */

/**
 * 类型判断工具
 */
const isType = (value: any, type: string): boolean => {
    return Object.prototype.toString.call(value).slice(8, -1).toLowerCase() === type.toLowerCase();
};

/**
 * 小驼峰转下划线
 * @param str - 小驼峰格式字符串
 * @returns 下划线字符串
 *
 * @example
 * toSnakeCase('userId') // 'user_id'
 * toSnakeCase('createdAt') // 'created_at'
 * toSnakeCase('userName') // 'user_name'
 */
export const toSnakeCase = (str: string): string => {
    if (!str || typeof str !== 'string') return str;
    return String(str)
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1_$2')
        .toLowerCase();
};

/**
 * 下划线转小驼峰
 * @param str - 下划线格式字符串
 * @returns 小驼峰字符串
 *
 * @example
 * toCamelCase('user_id') // 'userId'
 * toCamelCase('created_at') // 'createdAt'
 * toCamelCase('user_name') // 'userName'
 */
export const toCamelCase = (str: string): string => {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

/**
 * 对象字段名转下划线
 * @param obj - 源对象
 * @returns 字段名转为下划线格式的新对象
 *
 * @example
 * keysToSnake({ userId: 123, userName: 'John' }) // { user_id: 123, user_name: 'John' }
 * keysToSnake({ createdAt: 1697452800000 }) // { created_at: 1697452800000 }
 */
export const keysToSnake = <T = any>(obj: Record<string, any>): T => {
    if (!obj || !isType(obj, 'object')) return obj as T;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = toSnakeCase(key);
        result[snakeKey] = value;
    }
    return result;
};

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
    if (!obj || !isType(obj, 'object')) return obj as T;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = toCamelCase(key);
        result[camelKey] = value;
    }
    return result;
};

/**
 * 数组对象字段名批量转小驼峰
 * @param arr - 源数组
 * @returns 字段名转为小驼峰格式的新数组
 *
 * @example
 * arrayKeysToCamel([
 *   { user_id: 1, user_name: 'John' },
 *   { user_id: 2, user_name: 'Jane' }
 * ])
 * // [{ userId: 1, userName: 'John' }, { userId: 2, userName: 'Jane' }]
 */
export const arrayKeysToCamel = <T = any>(arr: Record<string, any>[]): T[] => {
    if (!arr || !isType(arr, 'array')) return arr as T[];
    return arr.map((item) => keysToCamel<T>(item));
};

/**
 * 转换数据库 BIGINT 字段为数字类型
 * 当 bigint: false 时，Bun SQL 会将大于 u32 的 BIGINT 返回为字符串，此函数将其转换为 number
 *
 * 转换规则：
 * 1. 白名单中的字段会被转换
 * 2. 所有以 'Id' 或 '_id' 结尾的字段会被自动转换
 * 3. 所有以 'At' 或 '_at' 结尾的字段会被自动转换（时间戳字段）
 * 4. 其他字段保持不变
 *
 * @param arr - 数据数组
 * @param fields - 额外需要转换的字段名数组（默认：['id', 'pid', 'sort']）
 * @returns 转换后的数组
 *
 * @example
 * // 基础字段 + 自动匹配以 Id/At 结尾的字段
 * convertBigIntFields([
 *   {
 *     id: '1760695696283001',      // ✅ 转换（在白名单）
 *     pid: '0',                     // ✅ 转换（在白名单）
 *     categoryId: '123',            // ✅ 转换（以 Id 结尾）
 *     user_id: '456',               // ✅ 转换（以 _id 结尾）
 *     createdAt: '1697452800000',  // ✅ 转换（以 At 结尾）
 *     created_at: '1697452800000', // ✅ 转换（以 _at 结尾）
 *     phone: '13800138000',         // ❌ 不转换（不匹配规则）
 *     name: 'test'                  // ❌ 不转换（不匹配规则）
 *   }
 * ])
 * // [{ id: 1760695696283001, pid: 0, categoryId: 123, user_id: 456, createdAt: 1697452800000, created_at: 1697452800000, phone: '13800138000', name: 'test' }]
 */
export const convertBigIntFields = <T = any>(arr: Record<string, any>[], fields: string[] = ['id', 'pid', 'sort']): T[] => {
    if (!arr || !isType(arr, 'array')) return arr as T[];

    return arr.map((item) => {
        const converted = { ...item };

        // 遍历对象的所有字段
        for (const [key, value] of Object.entries(converted)) {
            // 跳过 undefined 和 null
            if (value === undefined || value === null) {
                continue;
            }

            // 判断是否需要转换：
            // 1. 在白名单中
            // 2. 以 'Id' 结尾（如 userId, roleId, categoryId）
            // 3. 以 '_id' 结尾（如 user_id, role_id）
            // 4. 以 'At' 结尾（如 createdAt, updatedAt）
            // 5. 以 '_at' 结尾（如 created_at, updated_at）
            const shouldConvert = fields.includes(key) || key.endsWith('Id') || key.endsWith('_id') || key.endsWith('At') || key.endsWith('_at');

            if (shouldConvert && typeof value === 'string') {
                const num = Number(value);
                if (!isNaN(num)) {
                    converted[key] = num;
                }
            }
            // number 类型保持不变（小于 u32 的值）
        }

        return converted as T;
    }) as T[];
};
