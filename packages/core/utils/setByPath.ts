import { isPlainObject } from "./isPlainObject";

export function setByPath(target: Record<string, any>, path: string, value: unknown): void {
    const parts = path.split(".");
    // 避免无效 path（如 a..b）导致部分写入
    for (const part of parts) {
        if (!part) {
            return;
        }
    }
    let cur: Record<string, any> = target;

    for (let i = 0; i < parts.length; i++) {
        const key = parts[i];

        const isLast = i === parts.length - 1;
        if (isLast) {
            cur[key] = value;
            return;
        }

        const nextVal = cur[key];
        if (!isPlainObject(nextVal)) {
            cur[key] = {};
        }

        cur = cur[key] as Record<string, any>;
    }
}
