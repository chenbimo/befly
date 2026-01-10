export interface FieldClearOptions {
    pickKeys?: string[];
    omitKeys?: string[];
    keepValues?: unknown[];
    excludeValues?: unknown[];
    keepMap?: Record<string, unknown>;
}

export type FieldClearResult<T> = T extends Array<infer U> ? Array<FieldClearResult<U>> : T extends object ? { [K in keyof T]?: T[K] } : T;

export type FieldClear = <T = unknown>(data: T | T[], options?: FieldClearOptions) => FieldClearResult<T>;
