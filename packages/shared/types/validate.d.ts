/**
 * 验证相关类型定义
 */

/**
 * 字段类型
 */
export type FieldType = 'string' | 'number' | 'text' | 'array_string' | 'array_text' | 'array_number_string' | 'array_number_text';

/**
 * 字段定义类型（对象格式）
 */
export interface FieldDefinition {
    /** 字段标签/描述 */
    name: string;
    /** 字段详细说明 */
    detail: string;
    /** 字段类型 */
    type: FieldType;
    /** 最小值/最小长度 */
    min: number | null;
    /** 最大值/最大长度 */
    max: number | null;
    /** 默认值 */
    default: any;
    /** 是否创建索引 */
    index: boolean;
    /** 是否唯一 */
    unique: boolean;
    /** 是否允许为空 */
    nullable: boolean;
    /** 是否无符号（仅 number 类型） */
    unsigned: boolean;
    /** 正则验证 */
    regexp: string | null;
}

/**
 * 表定义类型（对象格式）
 */
export type TableDefinition = Record<string, FieldDefinition>;

/**
 * 验证结果类型
 */
export interface ValidateResult {
    /** 状态码：0=通过，1=失败 */
    code: 0 | 1;
    /** 是否失败 */
    failed: boolean;
    /** 第一个错误 */
    firstError: string | null;
    /** 所有错误 */
    errors: string[];
    /** 错误字段列表 */
    errorFields: string[];
    /** 字段错误映射 */
    fieldErrors: Record<string, string>;
}

/**
 * 单值验证结果
 */
export interface SingleResult {
    /** 转换后的值 */
    value: any;
    /** 错误信息（null 表示通过） */
    error: string | null;
}
