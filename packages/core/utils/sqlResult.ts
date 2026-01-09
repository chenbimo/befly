export type SqlRunResult = {
    changes?: number | bigint;
    lastInsertRowid?: number | bigint;
};

export function toNumberFromSql(value: unknown): number {
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return Number(value);
    return 0;
}
