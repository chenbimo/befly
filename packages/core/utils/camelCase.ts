function toWordParts(input: string): string[] {
    const normalized = String(input)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim();

    if (normalized.length === 0) {
        return [];
    }

    return normalized.split(/\s+/).filter((p) => p.length > 0);
}

function upperFirst(s: string): string {
    if (s.length === 0) {
        return s;
    }
    return s[0].toUpperCase() + s.slice(1);
}

/**
 * 把字符串转为小驼峰。
 * - 主要用于文件名/目录名（例如 my_plugin / my-plugin / my plugin）。
 */
export function camelCase(input: string): string {
    const parts = toWordParts(input);
    if (parts.length === 0) {
        return "";
    }

    const first = parts[0].toLowerCase();
    const rest = parts.slice(1).map((p) => upperFirst(p.toLowerCase()));
    return [first, ...rest].join("");
}
