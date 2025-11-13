/**
 * syncDb 常量定义模块
 *
 * 包含：
 * - 数据库类型判断
 * - 版本要求
 * - 数据类型映射
 * - 系统字段定义
 */

import { Env } from 'befly';

/**
 * 数据库版本要求
 */
export const DB_VERSION_REQUIREMENTS = {
    MYSQL_MIN_MAJOR: 8,
    POSTGRES_MIN_MAJOR: 17,
    SQLITE_MIN_VERSION: '3.50.0',
    SQLITE_MIN_VERSION_NUM: 35000 // 3 * 10000 + 50 * 100
} as const;

/**
 * 系统字段定义（所有表都包含的固定字段）
 */
export const SYSTEM_FIELDS = {
    ID: { name: 'id', comment: '主键ID' },
    CREATED_AT: { name: 'created_at', comment: '创建时间' },
    UPDATED_AT: { name: 'updated_at', comment: '更新时间' },
    DELETED_AT: { name: 'deleted_at', comment: '删除时间' },
    STATE: { name: 'state', comment: '状态字段' }
} as const;

/**
 * 需要创建索引的系统字段
 */
export const SYSTEM_INDEX_FIELDS = ['created_at', 'updated_at', 'state'] as const;

/**
 * 字段变更类型的中文标签映射
 */
export const CHANGE_TYPE_LABELS = {
    length: '长度',
    datatype: '类型',
    comment: '注释',
    default: '默认值',
    nullable: '可空约束',
    unique: '唯一约束'
} as const;

/**
 * MySQL 表配置
 *
 * 固定配置说明：
 * - ENGINE: InnoDB（支持事务、外键）
 * - CHARSET: utf8mb4（完整 Unicode 支持，包括 Emoji）
 * - COLLATE: utf8mb4_0900_ai_ci（MySQL 8.0 推荐，不区分重音和大小写）
 */
export const MYSQL_TABLE_CONFIG = {
    ENGINE: 'InnoDB',
    CHARSET: 'utf8mb4',
    COLLATE: 'utf8mb4_0900_ai_ci'
} as const;

// 数据库类型判断
export const DB = (Env.DB_TYPE || 'mysql').toLowerCase();
export const IS_MYSQL = DB === 'mysql';
export const IS_PG = DB === 'postgresql' || DB === 'postgres';
export const IS_SQLITE = DB === 'sqlite';

// 字段类型映射（按方言）
export const typeMapping = {
    number: IS_SQLITE ? 'INTEGER' : IS_PG ? 'BIGINT' : 'BIGINT',
    string: IS_SQLITE ? 'TEXT' : IS_PG ? 'character varying' : 'VARCHAR',
    text: IS_MYSQL ? 'MEDIUMTEXT' : 'TEXT',
    array_string: IS_SQLITE ? 'TEXT' : IS_PG ? 'character varying' : 'VARCHAR',
    array_text: IS_MYSQL ? 'MEDIUMTEXT' : 'TEXT'
};
