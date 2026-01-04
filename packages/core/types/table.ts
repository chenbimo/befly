/**
 * 表结构相关类型定义
 */

/**
 * 字段信息
 */
export interface FieldInfo {
    name: string;
    type: string;
    isPrimary: boolean;
    isNotNull: boolean;
    defaultValue?: any;
    isAutoIncrement?: boolean;
    isUnique?: boolean;
    comment?: string;
}

/**
 * 创建表选项
 */
export interface CreateTableOptions {
    table: string;
    fields: Record<string, string>;
    indexes?: string[];
    unique?: string[];
}

/**
 * SQL 帮助器选项
 */
export interface SqlHelperOptions {
    /** 数据库类型 */
    type: "mysql" | "postgres" | "sqlite";
    /** 表名前缀 */
    prefix?: string;
}
