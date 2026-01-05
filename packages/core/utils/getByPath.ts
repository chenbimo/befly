export function getByPath(obj: unknown, path: string): unknown {
    if (!path) {
        return obj;
    }

    const parts = path.split(".");
    let cur: any = obj;

    for (const part of parts) {
        if (cur === null || cur === undefined) {
            return undefined;
        }
        if (typeof cur !== "object") {
            return undefined;
        }
        cur = (cur as any)[part];
    }

    return cur;
}
