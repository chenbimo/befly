/**
 * CLI 项目类型定义
 * 集中管理所有接口和类型定义
 */

// ==================== 命令选项类型 ====================

/**
 * SyncDb 命令选项
 */
export interface SyncDbOptions {
    table?: string;
    dryRun: boolean;
}

/**
 * Sync 命令选项
 */
export interface SyncOptions {
    table?: string;
    force: boolean;
    dryRun: boolean;
    drop: boolean;
}

/**
 * SyncMenu 命令选项
 */
export interface SyncMenuOptions {
    plan?: boolean;
}

/**
 * 菜单配置
 */
export interface MenuConfig {
    name: string;
    path: string;
    icon?: string;
    sort?: number;
    type?: number;
    children?: MenuConfig[];
}

/**
 * SyncDev 命令选项
 */
export interface SyncDevOptions {
    plan?: boolean;
}

/**
 * SyncApi 命令选项
 */
export interface SyncApiOptions {
    plan?: boolean;
}

/**
 * API 信息
 */
export interface ApiInfo {
    name: string;
    path: string;
    method: string;
    description: string;
    addonName: string;
    addonTitle: string;
}

// ==================== 统计信息类型 ====================

/**
 * SyncDb 统计信息
 */
export interface SyncDbStats {
    processedTables: number;
    createdTables: number;
    modifiedTables: number;
    addFields: number;
    nameChanges: number;
    typeChanges: number;
    minChanges: number;
    maxChanges: number;
    defaultChanges: number;
    indexCreate: number;
    indexDrop: number;
}

/**
 * SyncMenu 统计信息
 */
export interface SyncMenuStats {
    totalMenus: number;
    parentMenus: number;
    childMenus: number;
    created: number;
    updated: number;
    deleted: number;
}

/**
 * SyncDev 统计信息
 */
export interface SyncDevStats {
    adminCount: number;
    roleCount: number;
    cachedRoles: number;
}

/**
 * SyncApi 统计信息
 */
export interface SyncApiStats {
    totalApis: number;
    created: number;
    updated: number;
    deleted: number;
}

// ==================== 数据库相关类型 ====================

/**
 * 列信息接口
 */
export interface ColumnInfo {
    type: string;
    columnType: string;
    length: number | null;
    nullable: boolean;
    defaultValue: any;
    comment: string | null;
}

/**
 * 索引信息接口（键为索引名，值为列名数组）
 */
export interface IndexInfo {
    [indexName: string]: string[];
}

/**
 * 字段变更接口
 */
export interface FieldChange {
    type: 'length' | 'datatype' | 'comment' | 'default';
    current: any;
    expected: any;
}

/**
 * 索引操作接口
 */
export interface IndexAction {
    action: 'create' | 'drop';
    indexName: string;
    fieldName: string;
}

/**
 * 表变更计划接口
 */
export interface TablePlan {
    changed: boolean;
    addClauses: string[];
    modifyClauses: string[];
    defaultClauses: string[];
    indexActions: IndexAction[];
    commentActions?: string[];
}

/**
 * 全局统计对象
 */
export interface GlobalStats {
    processedTables: number;
    createdTables: number;
    modifiedTables: number;
    addFields: number;
    nameChanges: number;
    typeChanges: number;
    minChanges: number;
    maxChanges: number;
    defaultChanges: number;
    indexCreate: number;
    indexDrop: number;
}

/**
 * 解析后的字段规则
 */
export interface ParsedFieldRule {
    name: string;
    type: 'string' | 'number' | 'text' | 'array_string' | 'array_text';
    min: number | null;
    max: number | null;
    default: any;
    index: 0 | 1;
    regex: string | null;
}

/**
 * 阶段统计信息
 */
export interface PhaseStats {
    startTime: number;
    endTime?: number;
    duration?: number;
}
