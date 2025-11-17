// fieldClear 类型定义

export interface FieldClearOptions {
    pick?: string[]; // 只保留这些字段
    omit?: string[]; // 排除这些字段
    keepValues?: any[]; // 只保留这些值
    excludeValues?: any[]; // 排除这些值
}

export type FieldClearResult<T> = T extends Array<infer U> ? Array<FieldClearResult<U>> : T extends object ? { [K in keyof T]?: T[K] } : T;
