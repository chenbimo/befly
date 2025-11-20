/**
 * 挑选指定字段
 */
export declare const pickFields: <T extends Record<string, any>>(obj: T, keys: string[]) => Partial<T>;
