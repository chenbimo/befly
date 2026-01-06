const HTTP_METHOD_PREFIX_RE = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/i;

/**
 * 将未知输入规范化为 pathname 字符串数组。
 *
 * 规则（契约）：
 * - value 为“假值”（null/undefined/""/0/false/NaN）时返回空数组 []。
 * - value 必须是 string[]，否则抛错：`${fieldLabel} 必须是字符串数组`。
 * - 数组元素必须满足：
 *   - 类型为 string
 *   - 不允许为空字符串
 *   - 不允许包含任何空白字符（空格/制表符/换行等）
 *   - 必须以 "/" 开头（pathname）
 * - forbidMethodPrefix=true 时，禁止 "GET/POST/..." 等 method 前缀，并给出更明确的错误提示。
 *
 * 注意：该函数不会做任何隐式修复/转换（例如 trim/split/JSON.parse/去重/排序）。
 */
export function normalizePathnameListInput(value: unknown, fieldLabel: string, forbidMethodPrefix: boolean): string[] {
    if (!value) return [];

    if (!Array.isArray(value)) {
        throw new Error(`${fieldLabel} 必须是字符串数组`);
    }

    const out: string[] = [];

    for (let i = 0; i < value.length; i += 1) {
        const item = value[i];
        const itemLabel = `${fieldLabel}[${i}]`;

        if (typeof item !== "string") {
            throw new Error(`${itemLabel} 必须是字符串`);
        }

        if (item.length === 0) {
            throw new Error(`${itemLabel} 不允许为空字符串`);
        }

        if (forbidMethodPrefix && HTTP_METHOD_PREFIX_RE.test(item)) {
            throw new Error(`${itemLabel} 不允许包含 method 前缀，应为 url.pathname（例如 /api/app/xxx）`);
        }

        if (/\s/.test(item)) {
            throw new Error(`${itemLabel} 不允许包含空白字符（空格/制表符/换行等）`);
        }

        if (!item.startsWith("/")) {
            throw new Error(`${itemLabel} 必须是 pathname（以 / 开头）`);
        }

        out.push(item);
    }

    return out;
}
