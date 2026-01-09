/**
 * 转换数据库 BIGINT 字段为数字类型
 *
 * 当 bigint: false 时，Bun SQL 会将大于 u32 的 BIGINT 返回为字符串，此方法将其转换为 number。
 *
 * 转换规则：
 * 1. 白名单中的字段会被转换
 * 2. 所有以 'Id' 或 '_id' 结尾的字段会被自动转换
 * 3. 所有以 'At' 或 '_at' 结尾的字段会被自动转换（时间戳字段）
 */
export function convertBigIntFields<T extends Record<string, unknown> = Record<string, unknown>>(arr: T[], fields?: readonly string[]): T[];
export function convertBigIntFields<T>(arr: T, fields?: readonly string[]): T;
export function convertBigIntFields<T extends Record<string, unknown> = Record<string, unknown>>(arr: unknown, fields: readonly string[] = ["id", "pid", "sort"]): unknown {
    if (!arr || !Array.isArray(arr)) {
        return arr;
    }

    return arr.map((item) => {
        const source = item as Record<string, unknown>;
        const converted: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(source)) {
            converted[key] = value;
        }

        for (const [key, value] of Object.entries(converted)) {
            if (value === undefined || value === null) {
                continue;
            }

            const shouldConvert = fields.includes(key) || key.endsWith("Id") || key.endsWith("_id") || key.endsWith("At") || key.endsWith("_at");

            if (shouldConvert && typeof value === "string") {
                const num = Number(value);
                if (!Number.isNaN(num)) {
                    converted[key] = num;
                }
            }
        }

        return converted as T;
    }) as T[];
}
