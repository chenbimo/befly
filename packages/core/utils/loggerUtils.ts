import { isPlainObject } from "./util";

export type SensitiveKeyMatcher = {
    exactSet: Set<string>;
    contains: string[];
};

export type LogSanitizeOptions = {
    maxStringLen: number;
    maxArrayItems: number;
    sanitizeDepth: number;
    sanitizeNodes: number;
    sanitizeObjectKeys: number;
    sensitiveKeyMatcher: SensitiveKeyMatcher;
};

export function buildSensitiveKeyMatcher(options: { builtinPatterns: string[]; userPatterns: unknown }): SensitiveKeyMatcher {
    const patterns: string[] = [];

    for (const item of options.builtinPatterns) {
        const trimmed = String(item).trim();
        if (trimmed.length > 0) {
            patterns.push(trimmed.toLowerCase());
        }
    }

    if (Array.isArray(options.userPatterns)) {
        for (const item of options.userPatterns) {
            const trimmed = String(item).trim();
            if (trimmed.length > 0) {
                patterns.push(trimmed.toLowerCase());
            }
        }
    }

    const exactSet = new Set<string>();
    const contains: string[] = [];

    for (const pat of patterns) {
        if (!pat.includes("*")) {
            exactSet.add(pat);
            continue;
        }

        const core = pat.replace(/\*+/g, "").trim();
        if (!core) {
            continue;
        }
        contains.push(core);
    }

    return { exactSet: exactSet, contains: contains };
}

export function isSensitiveKey(key: string, matcher: SensitiveKeyMatcher): boolean {
    const lower = String(key).toLowerCase();
    if (matcher.exactSet.has(lower)) return true;

    for (const part of matcher.contains) {
        if (lower.includes(part)) return true;
    }

    return false;
}

function truncateString(value: string, maxLen: number): string {
    if (value.length <= maxLen) return value;
    return value.slice(0, maxLen);
}

function sanitizeErrorValue(err: Error, options: LogSanitizeOptions): Record<string, any> {
    const out: Record<string, any> = {
        name: err.name || "Error",
        message: truncateString(err.message || "", options.maxStringLen)
    };

    if (typeof err.stack === "string") {
        out["stack"] = truncateString(err.stack, options.maxStringLen);
    }

    return out;
}

function safeToStringMasked(value: any, options: LogSanitizeOptions, visited: WeakSet<object>): string {
    if (typeof value === "string") return value;

    if (value instanceof Error) {
        try {
            return JSON.stringify(sanitizeErrorValue(value, options));
        } catch {
            return `${value.name || "Error"}: ${value.message || ""}`;
        }
    }

    if (value && typeof value === "object") {
        if (visited.has(value as object)) {
            return "[Circular]";
        }
    }

    try {
        const localVisited = visited;
        const replacer = (k: string, v: any) => {
            if (k && isSensitiveKey(k, options.sensitiveKeyMatcher)) {
                return "[MASKED]";
            }

            if (v && typeof v === "object") {
                if (localVisited.has(v as object)) {
                    return "[Circular]";
                }
                localVisited.add(v as object);
            }

            return v;
        };

        return JSON.stringify(value, replacer);
    } catch {
        try {
            return String(value);
        } catch {
            return "[Unserializable]";
        }
    }
}

function stringifyPreview(value: any, options: LogSanitizeOptions, visited: WeakSet<object>): string {
    const s = safeToStringMasked(value, options, visited);
    return truncateString(s, options.maxStringLen);
}

function sanitizeAny(value: any, options: LogSanitizeOptions, state: { nodes: number }, depth: number, visited: WeakSet<object>): any {
    if (value === null || value === undefined) return value;

    if (typeof value === "string") {
        return truncateString(value, options.maxStringLen);
    }

    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return value;
    }

    if (value instanceof Error) {
        return sanitizeErrorValue(value, options);
    }

    const isArr = Array.isArray(value);
    const isObj = isPlainObject(value);

    if (!isArr && !isObj) {
        return stringifyPreview(value, options, visited);
    }

    if (visited.has(value as object)) {
        return "[Circular]";
    }

    if (depth >= options.sanitizeDepth) {
        return stringifyPreview(value, options, visited);
    }

    if (state.nodes >= options.sanitizeNodes) {
        return stringifyPreview(value, options, visited);
    }

    visited.add(value as object);
    state.nodes = state.nodes + 1;

    if (isArr) {
        const arr = value as any[];
        const out: any[] = [];

        const limit = arr.length > options.maxArrayItems ? options.maxArrayItems : arr.length;
        for (let i = 0; i < limit; i++) {
            out[i] = sanitizeAny(arr[i], options, state, depth + 1, visited);
        }

        return out;
    }

    const obj = value as Record<string, any>;
    const out: Record<string, any> = {};

    const entries = Object.entries(obj);
    const limit = entries.length > options.sanitizeObjectKeys ? options.sanitizeObjectKeys : entries.length;

    for (let i = 0; i < limit; i++) {
        const entry = entries[i];
        if (!entry) {
            continue;
        }
        const key = entry[0];
        const child = entry[1];

        if (isSensitiveKey(key, options.sensitiveKeyMatcher)) {
            out[key] = "[MASKED]";
            continue;
        }

        out[key] = sanitizeAny(child, options, state, depth + 1, visited);
    }

    return out;
}

export function sanitizeLogObject(obj: Record<string, any>, options: LogSanitizeOptions): Record<string, any> {
    const visited = new WeakSet<object>();
    const state = { nodes: 0 };

    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
        if (isSensitiveKey(key, options.sensitiveKeyMatcher)) {
            out[key] = "[MASKED]";
            continue;
        }

        out[key] = sanitizeAny(val, options, state, 0, visited);
    }

    return out;
}
