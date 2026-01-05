import { isPlainObject } from "./isPlainObject";

export function setByPath(target: Record<string, any>, path: string, value: unknown): void {
    const parts = path.split(".");
    let cur: Record<string, any> = target;

    for (let i = 0; i < parts.length; i++) {
        const key = parts[i];
        if (!key) {
            return;
        }

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
