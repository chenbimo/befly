/**
 * 数据同步相关类型定义
 */

import type { BeflyContext } from "./befly";
import type { JsonValue, KeyValue } from "./common";

/**
 * 同步结果
 */
export interface SyncResult {
    /** 是否成功 */
    success: boolean;
    /** 同步的数量 */
    count: number;
    /** 错误信息 */
    error?: string;
    /** 额外数据 */
    data?: KeyValue;
}

/**
 * 同步选项
 */
export interface SyncOptions {
    /** 是否强制同步（覆盖已有数据） */
    force?: boolean;
    /** 是否跳过已存在的数据 */
    skipExisting?: boolean;
    /** 同步批次大小 */
    batchSize?: number;
    /** 其他选项 */
    [key: string]: JsonValue | undefined;
}

/**
 * 同步器接口
 */
export interface Syncer {
    /** 同步菜单 */
    syncMenus(): Promise<SyncResult>;

    /** 同步 API */
    syncApis(): Promise<SyncResult>;

    /** 同步字段定义 */
    syncFields(): Promise<SyncResult>;

    /** 同步所有 */
    syncAll(): Promise<SyncResult>;
}

/**
 * Syncer 构造函数
 */
export interface SyncerConstructor {
    new (befly: BeflyContext, options?: SyncOptions): Syncer;
}

// ---------------------------------------------------------------------------
// 菜单/API 同步
// ---------------------------------------------------------------------------

export interface MenuConfig {
    path?: string;
    name?: string;
    sort?: number;
    parentPath?: string;
    children?: MenuConfig[];
    [key: string]: JsonValue | undefined;
}

export interface SyncApiItem {
    type?: "api" | string;
    name: string;
    /** 是否需要登录：0=免登录，1=需登录（同步时会归一化为 0/1） */
    auth?: 0 | 1 | boolean;
    path: string;
    parentPath: string;
    addonName: string;
    [key: string]: JsonValue | undefined;
}

// ---------------------------------------------------------------------------
// 表结构同步（syncTable）
// ---------------------------------------------------------------------------

export interface ColumnInfo {
    type: string;
    columnType: string;
    length: number | null;
    max: number | null;
    nullable: boolean;
    defaultValue: JsonValue;
    comment: string | null;
}

export type IndexInfo = Record<string, string[]>;

export interface FieldChange {
    type: string;
    current: JsonValue;
    expected: JsonValue;
}

export interface TablePlan {
    changed: boolean;
    addClauses: string[];
    modifyClauses: string[];
    defaultClauses: string[];
    indexActions: Array<{ action: "create" | "drop"; indexName: string; fieldName: string }>;
    commentActions?: string[];
}
