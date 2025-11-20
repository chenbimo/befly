export interface FieldClearOptions {
    pickKeys?: string[];
    omitKeys?: string[];
    keepValues?: any[];
    excludeValues?: any[];
}
export type FieldClearResult<T> = T extends Array<infer U> ? Array<FieldClearResult<U>> : T extends object ? {
    [K in keyof T]?: T[K];
} : T;
export declare function fieldClear<T = any>(data: T | T[], options?: FieldClearOptions): FieldClearResult<T>;
