/**
 * CLI 项目类型定义
 * 集中管理所有接口和类型定义
 */

// ==================== 命令选项类型 ====================

/**
 * SyncTable（sync:db）命令选项
 */
export interface SyncDbOptions {
    table?: string;
    dryRun?: boolean;
    force?: boolean;
}

/**
 * Sync 命令选项
 */
export interface SyncOptions {
    table?: string;
    force?: boolean;
    dryRun?: boolean;
    drop?: boolean;
}

/**
 * SyncMenu 命令选项
 */
export interface SyncMenuOptions {
}

/**
 * 菜单配置
 */
export interface MenuConfig {
    name: string;
    path: string;
    icon?: string;
    sort?: number;
    children?: MenuConfig[];
}

/**
 * 菜单配置来源（三值约束）
 */
export type MenuConfigSource = "core" | "app" | "addon";

/**
 * SyncDev 命令选项
 */
export interface SyncDevOptions {
}

/**
 * SyncApi 命令选项
 */
export interface SyncApiOptions {
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
    max?: number | null;
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
    type: "length" | "datatype" | "comment" | "default" | "nullable";
    current: any;
    expected: any;
}

/**
 * 索引操作接口
 */
export interface IndexAction {
    action: "create" | "drop";
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
    type: "string" | "number" | "text" | "array_string" | "array_text";
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

// ==================== 报告相关类型 ====================

/**
 * 完整的同步报告数据结构
 */
export interface SyncReport {
    meta: SyncReportMeta;
    database: DatabaseReport;
    api: ApiReport;
    menu: MenuReport;
    dev: DevReport;
}

/**
 * 报告元信息
 */
export interface SyncReportMeta {
    timestamp: number;
    timestampStr: string;
    environment: string;
    totalTime: number;
    status: "success" | "error";
    error?: string;
}

/**
 * 数据库同步报告
 */
export interface DatabaseReport {
    stats: SyncDbStats;
    details: {
        tables: TableChangeDetail[];
    };
    timing: {
        validation: number;
        connection: number;
        scanning: number;
        processing: number;
    };
}

/**
 * 表变更详情
 */
export interface TableChangeDetail {
    name: string;
    source: "app" | "addon";
    addonName?: string;
    action: "create" | "modify" | "none";
    fields: {
        added: FieldDetail[];
        modified: FieldModification[];
        removed: FieldDetail[];
    };
    indexes: {
        added: IndexDetail[];
        removed: IndexDetail[];
    };
    sql: string[];
}

/**
 * 字段详情
 */
export interface FieldDetail {
    name: string;
    type: string;
    length?: number;
    nullable?: boolean;
    defaultValue?: any;
    comment?: string;
}

/**
 * 字段修改详情
 */
export interface FieldModification {
    name: string;
    before: FieldDetail;
    after: FieldDetail;
    changeType: "type" | "length" | "default" | "nullable" | "comment";
}

/**
 * 索引详情
 */
export interface IndexDetail {
    name: string;
    fields: string[];
    type?: string;
}

/**
 * 接口同步报告
 */
export interface ApiReport {
    stats: {
        totalApis: number;
        projectApis: number;
        addonApis: number;
        created: number;
        updated: number;
        deleted: number;
    };
    details: {
        bySource: {
            project: ApiDetail[];
            addons: Record<string, ApiDetail[]>;
        };
        byAction: {
            created: ApiDetail[];
            updated: ApiDetailWithDiff[];
            deleted: ApiDetail[];
        };
    };
    timing: {
        scanning: number;
        processing: number;
        caching: number;
    };
}

/**
 * 接口详情
 */
export interface ApiDetail {
    name: string;
    path: string;
    method: string;
    description: string;
    addonName: string;
    addonTitle: string;
    auth?: boolean;
}

/**
 * 带差异的接口详情
 */
export interface ApiDetailWithDiff extends ApiDetail {
    changes: {
        field: string;
        before: any;
        after: any;
    }[];
}

/**
 * 菜单同步报告
 */
export interface MenuReport {
    stats: SyncMenuStats;
    details: {
        tree: MenuTreeNode[];
        byAction: {
            created: MenuDetail[];
            updated: MenuDetailWithDiff[];
            deleted: MenuDetail[];
        };
    };
    timing: {
        scanning: number;
        processing: number;
        caching: number;
    };
}

/**
 * 菜单树节点
 */
export interface MenuTreeNode {
    name: string;
    path: string;
    icon?: string;
    sort?: number;
    type?: number;
    action?: "created" | "updated" | "none";
    children?: MenuTreeNode[];
}

/**
 * 菜单详情
 */
export interface MenuDetail {
    name: string;
    path: string;
    icon?: string;
    sort?: number;
    type?: number;
    addonName: string;
    addonTitle: string;
}

/**
 * 带差异的菜单详情
 */
export interface MenuDetailWithDiff extends MenuDetail {
    changes: {
        field: string;
        before: any;
        after: any;
    }[];
}

/**
 * 管理员详情
 */
export interface AdminDetail {
    username: string;
    action: "created" | "updated" | "exists";
}

/**
 * 角色详情
 */
export interface RoleDetail {
    name: string;
    permissions: number;
    action: "created" | "updated" | "exists";
}
