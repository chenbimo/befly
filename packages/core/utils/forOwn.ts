import { isPlainObject } from "./isPlainObject";

export function forOwn(obj: unknown, iteratee: (value: any, key: string) => void): void {
    if (typeof iteratee !== "function") {
        return;
    }

    if (!isPlainObject(obj)) {
        return;
    }

    for (const key of Object.keys(obj)) {
        iteratee((obj as any)[key], key);
    }
}
