/**
 * 表结构相关类型定义
 */

/**
 * 保留字段（系统自动管理）
 */
export type ReservedFields = 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'state';

/**
 * 系统字段（所有表都有的字段）
 */
export interface SystemFields {
    /** 主键 ID（雪花 ID） */
    id: number;
    /** 状态：0=已删除, 1=正常, 2=禁用 */
    state: number;
    /** 创建时间（毫秒时间戳） */
    createdAt: number;
    /** 更新时间（毫秒时间戳） */
    updatedAt: number;
    /** 删除时间（毫秒时间戳，软删除时设置） */
    deletedAt: number | null;
}

/**
 * 基础表类型（包含系统字段）
 */
export type BaseTable<T extends Record<string, any>> = T & SystemFields;

/**
 * 插入类型：排除系统自动生成的字段
 */
export type InsertType<T> = Omit<T, keyof SystemFields>;

/**
 * 更新类型：所有字段可选，排除不可修改的系统字段
 */
export type UpdateType<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;

/**
 * 查询结果类型：完整的表记录
 */
export type SelectType<T> = T;

/**
 * 排除保留字段
 */
export type ExcludeReserved<T> = Omit<T, ReservedFields>;
