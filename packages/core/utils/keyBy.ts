export function keyBy<T>(items: T[], getKey: (item: T) => string): Record<string, T> {
    const out: Record<string, T> = {};

    if (!Array.isArray(items) || typeof getKey !== "function") {
        return out;
    }

    for (const item of items) {
        const key = getKey(item);
        if (typeof key !== "string" || key === "") {
            continue;
        }
        out[key] = item;
    }

    return out;
}
