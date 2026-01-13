/**
 * 数据验证相关类型定义
 */

import type { JsonValue } from "./common";

/**
 * 字段类型
 */
export type FieldType = "string" | "number" | "text" | "array_string" | "array_text" | "array_number_string" | "array_number_text";

/**
 * 字段定义（表字段 JSON 结构）
 */
export interface FieldDefinition {
    /** 字段标签（中文名） */
    name: string;
    /** 字段类型 */
    type: FieldType | string;
    /**
     * 最小值/最小长度。
     * - 缺省默认：null（表示不限制）
     */
    min?: number | null;
    /**
     * 最大值/最大长度。
     * - 缺省默认：null（表示不限制）
     */
    max?: number | null;
    /**
     * 默认值。
     * - 缺省默认：null（表示字段未提供默认值）
     */
    default?: JsonValue | null;
    /**
     * 字段描述。
     * - 缺省默认：""（空字符串）
     */
    detail?: string;
    /**
     * 是否创建索引。
     * - 缺省默认：false
     */
    index?: boolean;
    /**
     * 是否唯一约束。
     * - 缺省默认：false
     */
    unique?: boolean;
    /**
     * 是否可为 NULL。
     * - 缺省默认：false
     */
    nullable?: boolean;
    /**
     * number 类型是否无符号（仅 MySQL 语义生效）。
     * - 缺省默认：false
     */
    unsigned?: boolean;
    /**
     * 正则（或 @alias）。
     * - 缺省默认：null（表示无约束）
     */
    regexp?: string | null;
}

/**
 * 表定义（字段名 -> 字段定义）
 */
export type TableDefinition = Record<string, FieldDefinition>;

/**
 * validate(data, rules) 的返回结构
 */
export interface ValidateResult {
    code: 0 | 1;
    failed: boolean;
    firstError: string | null;
    errors: string[];
    errorFields: string[];
    fieldErrors: Record<string, string>;
}

/**
 * single(value, fieldDef) 的返回结构
 */
export interface SingleResult {
    value: JsonValue | null;
    error: string | null;
}

/**
 * Validator 静态类类型（对外）。
 *
 * 说明：runtime 实现是 `export class Validator`，以静态方法形式提供：
 * - `Validator.validate(data, rules, required)`
 * - `Validator.single(value, fieldDef)`
 */
export interface ValidatorStatic {
    /**
     * 推荐签名：正常业务使用。
     */
    validate(data: Record<string, JsonValue>, rules: TableDefinition, required?: string[]): ValidateResult;

    /**
     * 宽签名：用于边界输入（例如测试传入非法参数）——实现内部会做运行时校验。
     */
    validate(data: unknown, rules: unknown, required?: string[]): ValidateResult;

    single(value: unknown, fieldDef: FieldDefinition): SingleResult;
}
