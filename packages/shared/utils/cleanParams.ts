export function cleanParams<TData extends Record<string, unknown>>(data: TData, dropValues?: readonly unknown[], dropKeyValue?: Record<string, readonly unknown[]>): Partial<TData> {
    const globalDropValues = dropValues ?? [];
    const perKeyDropValues = dropKeyValue ?? {};

    const globalDropSet = new Set<unknown>(globalDropValues);

    const out: Record<string, unknown> = {};

    for (const key of Object.keys(data)) {
        const value = data[key];

        // 默认强制移除 null / undefined
        if (value === null || value === undefined) {
            continue;
        }

        // 如果该 key 配了规则：以 key 规则为准，不再应用全局 dropValues
        if (Object.hasOwn(perKeyDropValues, key)) {
            const keyDropValues = perKeyDropValues[key] ?? [];
            const keyDropSet = new Set<unknown>(keyDropValues);

            if (keyDropSet.has(value)) {
                continue;
            }

            out[key] = value;
            continue;
        }

        // 未配置 key 规则：应用全局 dropValues
        if (globalDropSet.has(value)) {
            continue;
        }

        out[key] = value;
    }

    return out as Partial<TData>;
}
