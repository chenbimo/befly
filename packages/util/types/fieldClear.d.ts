export interface FieldClearOptions {
    pick?: string[];
    omit?: string[];
    keepValues?: any[];
    excludeValues?: any[];
}
export type FieldClearResult<T> = T extends Array<infer U> ? Array<FieldClearResult<U>> : T extends object ? {
    [K in keyof T]?: T[K];
} : T;
