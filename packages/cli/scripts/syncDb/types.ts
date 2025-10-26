/**
 * syncDb 类型定义模块
 *
 * 集中管理核心类型定义
 */

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

// ==================== 变更相关类型 ====================

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

// ==================== 统计相关类型 ====================

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

// ==================== 解析相关类型 ====================

/**
 * 解析后的字段规则
 */
export interface ParsedFieldRule {
    name: string;
    type: string;
    min: any;
    max: any;
    default: any;
    index: number;
    regex: string;
}
