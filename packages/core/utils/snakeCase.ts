function normalizeToWords(input: string): string {
    return String(input)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim();
}

/**
 * 把字符串转为 snake_case。
 * - 主要用于表名/字段名（例如 userId -> user_id）。
 */
export function snakeCase(input: string): string {
    const normalized = normalizeToWords(input);
    if (normalized.length === 0) {
        return "";
    }

    return normalized
        .split(/\s+/)
        .filter((p) => p.length > 0)
        .map((p) => p.toLowerCase())
        .join("_");
}
