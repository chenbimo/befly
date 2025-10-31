/**
 * 验证器相关类型定义
 */

/**
 * 字段验证错误信息
 */
export type ValidationError = string | null;

/**
 * 字段类型
 */
export type FieldType = 'string' | 'number' | 'text' | 'array';

/**
 * 验证结果
 */
export interface ValidationResult {
    /** 验证状态码：0=成功，1=失败 */
    code: 0 | 1;
    /** 字段验证结果 */
    fields: Record<string, any>;
}

/**
 * 字段规则
 */
export interface FieldRule {
    /** 字段名 */
    name: string;
    /** 字段类型 */
    type: FieldType;
    /** 最小值/长度 */
    min: number | null;
    /** 最大值/长度 */
    max: number | null;
    /** 默认值 */
    default: any;
    /** 是否索引 */
    index: 0 | 1;
    /** 正则约束 */
    regex: string | null;
}
