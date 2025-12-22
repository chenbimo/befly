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
export function convertBigIntFields<T = any>(arr: Record<string, any>[], fields: string[] = ["id", "pid", "sort"]): T[] {
    if (!arr || !Array.isArray(arr)) {
        return arr as T[];
    }

    return arr.map((item) => {
        const converted: Record<string, any> = {};
        for (const [key, value] of Object.entries(item)) {
            converted[key] = value;
        }

        for (const [key, value] of Object.entries(converted)) {
            if (value === undefined || value === null) {
                continue;
            }

            const shouldConvert = fields.includes(key) || key.endsWith("Id") || key.endsWith("_id") || key.endsWith("At") || key.endsWith("_at");
            if (shouldConvert && typeof value === "string") {
                const num = Number(value);
                if (!isNaN(num)) {
                    converted[key] = num;
                }
            }
        }

        return converted as T;
    }) as T[];
}
