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
    if (arr === null || arr === undefined) {
        return arr;
    }

    const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
    const MIN_SAFE_INTEGER_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);

    const convertRecord = (source: Record<string, unknown>): Record<string, unknown> => {
        const converted: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(source)) {
            converted[key] = value;
        }

        for (const [key, value] of Object.entries(converted)) {
            if (value === undefined || value === null) {
                continue;
            }

            const shouldConvert = fields.includes(key) || key.endsWith("Id") || key.endsWith("_id") || key.endsWith("At") || key.endsWith("_at");
            if (!shouldConvert) {
                continue;
            }

            let bigintValue: bigint | null = null;
            if (typeof value === "bigint") {
                bigintValue = value;
            } else if (typeof value === "string") {
                // BIGINT 字段应为整数；非整数/非数字字符串不做转换
                if (!/^-?\d+$/.test(value)) {
                    continue;
                }
                try {
                    bigintValue = BigInt(value);
                } catch {
                    continue;
                }
            } else {
                continue;
            }

            if (bigintValue > MAX_SAFE_INTEGER_BIGINT || bigintValue < MIN_SAFE_INTEGER_BIGINT) {
                throw new Error(`BIGINT 字段超出 JS 安全整数范围，请改用 bigint/string 或调整字段设计 (field: ${key}, value: ${String(value)})`);
            }

            converted[key] = Number(bigintValue);
        }

        return converted;
    };

    if (Array.isArray(arr)) {
        return arr.map((item) => convertRecord(item as Record<string, unknown>)) as T[];
    }

    if (typeof arr === "object") {
        return convertRecord(arr as Record<string, unknown>) as T;
    }

    return arr;
}
