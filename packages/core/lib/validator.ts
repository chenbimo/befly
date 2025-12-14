/**
 * 数据验证器 - Befly 项目专用
 * 纯静态类设计，简洁易用
 */

import { RegexAliases, getCompiledRegex } from 'befly-shared/regex';
import type { TableDefinition, FieldDefinition, ValidateResult, SingleResult } from 'befly-shared/types';

/**
 * 验证器类
 *
 * @example
 * const result = Validator.validate(data, rules, ['email', 'name']);
 * if (result.failed) {
 *     console.log(result.firstError);
 *     console.log(result.errors);
 *     console.log(result.errorFields);
 * }
 *
 * const single = Validator.single(value, fieldDef);
 * if (!single.error) {
 *     console.log(single.value);
 * }
 */
export class Validator {
    /**
     * 验证数据对象
     */
    static validate(data: Record<string, any>, rules: TableDefinition, required: string[] = []): ValidateResult {
        const fieldErrors: Record<string, string> = {};

        // 参数检查
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return this.buildResult({ _error: '数据必须是对象格式' });
        }
        if (!rules || typeof rules !== 'object') {
            return this.buildResult({ _error: '验证规则必须是对象格式' });
        }

        // 检查必填字段
        for (const field of required) {
            const value = data[field];
            if (value === undefined || value === null || value === '') {
                const label = rules[field]?.name || field;
                fieldErrors[field] = `${label}为必填项`;
            }
        }

        // 验证有值的字段
        for (const [field, rule] of Object.entries(rules)) {
            if (fieldErrors[field]) continue;
            // 字段值为 undefined 时跳过验证（除非是必填字段，但必填字段已在上面检查过）
            if (data[field] === undefined && !required.includes(field)) continue;

            const error = this.checkField(data[field], rule, field);
            if (error) fieldErrors[field] = error;
        }

        return this.buildResult(fieldErrors);
    }

    /**
     * 验证单个值（带类型转换）
     */
    static single(value: any, fieldDef: FieldDefinition): SingleResult {
        const { type, default: defaultValue } = fieldDef;

        // 处理空值
        if (value === undefined || value === null || value === '') {
            return { value: this.defaultFor(type, defaultValue), error: null };
        }

        // 类型转换
        const converted = this.convert(value, type);
        if (converted.error) {
            return { value: null, error: converted.error };
        }

        // 规则验证
        const error = this.checkRule(converted.value, fieldDef);
        if (error) {
            return { value: null, error: error };
        }

        return { value: converted.value, error: null };
    }

    // ========== 私有方法 ==========

    /** 构建结果对象 */
    private static buildResult(fieldErrors: Record<string, string>): ValidateResult {
        const errors = Object.values(fieldErrors);
        const errorFields = Object.keys(fieldErrors);
        const failed = errors.length > 0;

        return {
            code: failed ? 1 : 0,
            failed: failed,
            firstError: failed ? errors[0] : null,
            errors: errors,
            errorFields: errorFields,
            fieldErrors: fieldErrors
        };
    }

    /** 验证单个字段 */
    private static checkField(value: any, fieldDef: FieldDefinition, fieldName: string): string | null {
        const label = fieldDef.name || fieldName;

        const converted = this.convert(value, fieldDef.type);
        if (converted.error) {
            return `${label}${converted.error}`;
        }

        const error = this.checkRule(converted.value, fieldDef);
        return error ? `${label}${error}` : null;
    }

    /** 类型转换 */
    private static convert(value: any, type: string): { value: any; error: string | null } {
        switch (type.toLowerCase()) {
            case 'number':
                if (typeof value === 'number') {
                    return Number.isNaN(value) || !isFinite(value) ? { value: null, error: '必须是有效数字' } : { value: value, error: null };
                }
                if (typeof value === 'string') {
                    const num = Number(value);
                    return Number.isNaN(num) || !isFinite(num) ? { value: null, error: '必须是数字' } : { value: num, error: null };
                }
                return { value: null, error: '必须是数字' };

            case 'string':
            case 'text':
                return typeof value === 'string' ? { value: value, error: null } : { value: null, error: '必须是字符串' };

            case 'array_string':
            case 'array_text':
                return Array.isArray(value) ? { value: value, error: null } : { value: null, error: '必须是数组' };

            default:
                return { value: value, error: null };
        }
    }

    /** 规则验证 */
    private static checkRule(value: any, fieldDef: FieldDefinition): string | null {
        const { type, min, max, regexp } = fieldDef;
        const regex = this.resolveRegex(regexp);

        switch (type.toLowerCase()) {
            case 'number':
                if (min !== null && value < min) return `不能小于${min}`;
                if (max !== null && max > 0 && value > max) return `不能大于${max}`;
                if (regex && !this.testRegex(regex, String(value))) return '格式不正确';
                break;

            case 'string':
            case 'text':
                if (min !== null && value.length < min) return `长度不能少于${min}个字符`;
                if (max !== null && max > 0 && value.length > max) return `长度不能超过${max}个字符`;
                if (regex && !this.testRegex(regex, value)) return '格式不正确';
                break;

            case 'array_string':
            case 'array_text':
                if (min !== null && value.length < min) return `至少需要${min}个元素`;
                if (max !== null && max > 0 && value.length > max) return `最多只能有${max}个元素`;
                if (regex) {
                    for (const item of value) {
                        if (!this.testRegex(regex, String(item))) return '元素格式不正确';
                    }
                }
                break;
        }
        return null;
    }

    /** 解析正则别名 */
    private static resolveRegex(regexp: string | null): string | null {
        if (!regexp) return null;
        if (regexp.startsWith('@')) {
            const key = regexp.substring(1) as keyof typeof RegexAliases;
            return RegexAliases[key] || regexp;
        }
        return regexp;
    }

    /** 测试正则 */
    private static testRegex(pattern: string, value: string): boolean {
        try {
            return getCompiledRegex(pattern).test(value);
        } catch {
            return false;
        }
    }

    /** 获取默认值 */
    private static defaultFor(type: string, defaultValue: any): any {
        if (defaultValue !== null && defaultValue !== undefined) {
            // 数组默认值
            if ((type === 'array_string' || type === 'array_text') && typeof defaultValue === 'string') {
                if (defaultValue === '[]') return [];
                try {
                    const parsed = JSON.parse(defaultValue);
                    return Array.isArray(parsed) ? parsed : [];
                } catch {
                    return [];
                }
            }
            // 数字默认值
            if (type === 'number' && typeof defaultValue === 'string') {
                const num = Number(defaultValue);
                return isNaN(num) ? 0 : num;
            }
            return defaultValue;
        }

        // 类型默认值
        switch (type.toLowerCase()) {
            case 'number':
                return 0;
            case 'array_string':
            case 'array_text':
                return [];
            default:
                return '';
        }
    }
}
