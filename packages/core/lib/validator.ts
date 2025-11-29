/**
 * 数据验证器 - Befly 项目专用
 * 内置 RegexAliases，支持对象格式的字段定义
 * 使用正则缓存优化性能
 */

import type { ValidationResult, ValidationError } from '../types/validator';
import { RegexAliases, getCompiledRegex } from 'befly-shared/regex';
import type { TableDefinition, FieldDefinition } from 'befly-shared/types';

/**
 * 验证器类（Befly 项目专用）
 * 内置 RegexAliases，直接使用 util.ts 中的 parseRule
 */
export class Validator {
    /** 正则别名映射（内置） */
    private readonly regexAliases: Record<string, string> = RegexAliases;

    /**
     * 验证数据
     * @param data - 要验证的数据对象
     * @param rules - 验证规则对象
     * @param required - 必传字段数组
     * @returns 验证结果 { code: 0|1, fields: {} }
     */
    validate(data: Record<string, any>, rules: TableDefinition, required: string[] = []): ValidationResult {
        const result: ValidationResult = {
            code: 0,
            fields: {}
        };

        // 参数检查
        if (!this.checkParams(data, rules, required, result)) {
            return result;
        }

        // 检查必传字段
        this.checkRequiredFields(data, rules, required, result);

        // 验证所有在规则中定义的字段
        this.validateFields(data, rules, required, result);

        return result;
    }

    /**
     * 检查参数有效性
     */
    private checkParams(data: any, rules: any, required: any, result: ValidationResult): boolean {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            result.code = 1;
            result.fields.error = '数据必须是对象格式';
            return false;
        }

        if (!rules || typeof rules !== 'object') {
            result.code = 1;
            result.fields.error = '验证规则必须是对象格式';
            return false;
        }

        if (!Array.isArray(required)) {
            result.code = 1;
            result.fields.error = '必传字段必须是数组格式';
            return false;
        }

        return true;
    }

    /**
     * 检查必传字段
     */
    private checkRequiredFields(data: Record<string, any>, rules: TableDefinition, required: string[], result: ValidationResult): void {
        for (const fieldName of required) {
            const value = data[fieldName];
            if (!(fieldName in data) || value === undefined || value === null || value === '') {
                result.code = 1;
                const fieldDef = rules[fieldName];
                const fieldLabel = fieldDef?.name || fieldName;
                result.fields[fieldName] = `${fieldLabel}(${fieldName})为必填项`;
            }
        }
    }

    /**
     * 验证所有字段
     */
    private validateFields(data: Record<string, any>, rules: TableDefinition, required: string[], result: ValidationResult): void {
        for (const [fieldName, rule] of Object.entries(rules)) {
            // 如果字段不存在且不是必传字段，跳过验证
            if (!(fieldName in data) && !required.includes(fieldName)) {
                continue;
            }

            // 如果必传验证已经失败，跳过后续验证
            if (result.fields[fieldName]) {
                continue;
            }

            const value = data[fieldName];
            const error = this.validateFieldValue(value, rules[fieldName], fieldName);

            if (error) {
                result.code = 1;
                result.fields[fieldName] = error;
            }
        }
    }

    /**
     * 解析 regex 别名
     */
    private resolveRegexAlias(regex: string | null): string | null {
        if (!regex || typeof regex !== 'string') {
            return regex;
        }

        if (regex.startsWith('@')) {
            const aliasName = regex.substring(1);
            const resolvedRegex = this.regexAliases[aliasName];
            if (resolvedRegex) {
                return resolvedRegex;
            }
            return regex;
        }

        return regex;
    }

    /**
     * 验证单个字段的值
     */
    private validateFieldValue(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationError {
        let { name, type, min, max, regexp } = fieldDef;

        regexp = this.resolveRegexAlias(regexp);

        switch (type.toLowerCase()) {
            case 'number':
                return this.validateNumber(value, name, min, max, regexp, fieldName);
            case 'string':
            case 'text':
                return this.validateString(value, name, min, max, regexp, fieldName);
            case 'array_string':
            case 'array_text':
                return this.validateArray(value, name, min, max, regexp, fieldName);
            default:
                return `字段 ${fieldName} 的类型 ${type} 不支持`;
        }
    }

    /**
     * 验证数字类型
     */
    private validateNumber(value: any, name: string, min: number | null, max: number | null, spec: string | null, fieldName: string): ValidationError {
        try {
            // 允许数字类型的字符串
            let numValue = value;
            if (typeof value === 'string') {
                numValue = Number(value);
                if (Number.isNaN(numValue) || !isFinite(numValue)) {
                    return `${name}(${fieldName})必须是数字`;
                }
            } else if (typeof numValue !== 'number' || Number.isNaN(numValue) || !isFinite(numValue)) {
                return `${name}(${fieldName})必须是数字`;
            }

            if (min !== null && numValue < min) {
                return `${name}(${fieldName})不能小于${min}`;
            }

            if (max !== null && max > 0 && numValue > max) {
                return `${name}(${fieldName})不能大于${max}`;
            }

            if (spec && spec.trim() !== '') {
                try {
                    const regExp = getCompiledRegex(spec);
                    if (!regExp.test(String(numValue))) {
                        return `${name}(${fieldName})格式不正确`;
                    }
                } catch (error: any) {
                    return `${name}(${fieldName})的正则表达式格式错误`;
                }
            }

            return null;
        } catch (error: any) {
            return `${name}(${fieldName})验证出错: ${error.message}`;
        }
    }

    /**
     * 验证字符串类型
     */
    private validateString(value: any, name: string, min: number | null, max: number | null, spec: string | null, fieldName: string): ValidationError {
        try {
            if (typeof value !== 'string') {
                return `${name}(${fieldName})必须是字符串`;
            }

            if (min !== null && value.length < min) {
                return `${name}(${fieldName})长度不能少于${min}个字符`;
            }

            if (max !== null && max > 0 && value.length > max) {
                return `${name}(${fieldName})长度不能超过${max}个字符`;
            }

            if (spec && spec.trim() !== '') {
                try {
                    const regExp = getCompiledRegex(spec);
                    if (!regExp.test(value)) {
                        return `${name}(${fieldName})格式不正确`;
                    }
                } catch (error: any) {
                    return `${name}(${fieldName})的正则表达式格式错误`;
                }
            }

            return null;
        } catch (error: any) {
            return `${name}(${fieldName})验证出错: ${error.message}`;
        }
    }

    /**
     * 验证数组类型
     */
    private validateArray(value: any, name: string, min: number | null, max: number | null, spec: string | null, fieldName: string): ValidationError {
        try {
            if (!Array.isArray(value)) {
                return `${name}(${fieldName})必须是数组`;
            }

            if (min !== null && value.length < min) {
                return `${name}(${fieldName})至少需要${min}个元素`;
            }

            if (max !== null && max > 0 && value.length > max) {
                return `${name}(${fieldName})最多只能有${max}个元素`;
            }

            if (spec && spec.trim() !== '') {
                try {
                    const regExp = getCompiledRegex(spec);
                    for (const item of value) {
                        if (!regExp.test(String(item))) {
                            return `${name}(${fieldName})中的元素"${item}"格式不正确`;
                        }
                    }
                } catch (error: any) {
                    return `${name}(${fieldName})的正则表达式格式错误`;
                }
            }

            return null;
        } catch (error: any) {
            return `${name}(${fieldName})验证出错: ${error.message}`;
        }
    }

    /**
     * 验证单个值（支持对象格式字段定义）
     */
    validateSingleValue(value: any, fieldDef: FieldDefinition): { valid: boolean; value: any; errors: string[] } {
        let { name, type, min, max, regexp, default: defaultValue } = fieldDef;

        regexp = this.resolveRegexAlias(regexp);

        // 处理 undefined/null 值，使用默认值
        if (value === undefined || value === null) {
            if (defaultValue !== null) {
                if ((type === 'array_string' || type === 'array_text') && typeof defaultValue === 'string') {
                    if (defaultValue === '[]') {
                        return { valid: true, value: [], errors: [] };
                    }
                    try {
                        const parsedArray = JSON.parse(defaultValue);
                        if (Array.isArray(parsedArray)) {
                            return { valid: true, value: parsedArray, errors: [] };
                        }
                    } catch {
                        return { valid: true, value: [], errors: [] };
                    }
                }
                // 数字类型默认值转换
                if (type === 'number' && typeof defaultValue === 'string') {
                    const numValue = Number(defaultValue);
                    if (!isNaN(numValue)) {
                        return { valid: true, value: numValue, errors: [] };
                    }
                }
                return { valid: true, value: defaultValue, errors: [] };
            }
            if (type === 'number') {
                return { valid: true, value: 0, errors: [] };
            } else if (type === 'array_string' || type === 'array_text') {
                return { valid: true, value: [], errors: [] };
            } else if (type === 'string' || type === 'text') {
                return { valid: true, value: '', errors: [] };
            }
        }

        const errors: string[] = [];

        // 类型转换
        let convertedValue = value;
        if (type === 'number' && typeof value === 'string') {
            convertedValue = Number(value);
            if (isNaN(convertedValue)) {
                errors.push(`${name || '值'}必须是有效的数字`);
                return { valid: false, value: null, errors };
            }
        }

        // 类型验证
        switch (type.toLowerCase()) {
            case 'number':
                if (typeof convertedValue !== 'number' || Number.isNaN(convertedValue)) {
                    errors.push(`${name || '值'}必须是数字`);
                }
                if (min !== null && convertedValue < min) {
                    errors.push(`${name || '值'}不能小于${min}`);
                }
                if (max !== null && max > 0 && convertedValue > max) {
                    errors.push(`${name || '值'}不能大于${max}`);
                }
                if (regexp && regexp.trim() !== '') {
                    try {
                        const regExp = getCompiledRegex(regexp);
                        if (!regExp.test(String(convertedValue))) {
                            errors.push(`${name || '值'}格式不正确`);
                        }
                    } catch (e: any) {
                        errors.push(`${name || '值'}的正则表达式格式错误: ${e.message}`);
                    }
                }
                break;

            case 'string':
            case 'text':
                if (typeof convertedValue !== 'string') {
                    errors.push(`${name || '值'}必须是字符串`);
                }
                if (min !== null && convertedValue.length < min) {
                    errors.push(`${name || '值'}长度不能少于${min}个字符`);
                }
                if (max !== null && max > 0 && convertedValue.length > max) {
                    errors.push(`${name || '值'}长度不能超过${max}个字符`);
                }
                if (regexp && regexp.trim() !== '') {
                    try {
                        const regExp = getCompiledRegex(regexp);
                        if (!regExp.test(convertedValue)) {
                            errors.push(`${name || '值'}格式不正确`);
                        }
                    } catch {
                        errors.push(`${name || '值'}的正则表达式格式错误`);
                    }
                }
                break;

            case 'array_string':
            case 'array_text':
                if (!Array.isArray(convertedValue)) {
                    errors.push(`${name || '值'}必须是数组`);
                }
                if (min !== null && convertedValue.length < min) {
                    errors.push(`${name || '值'}元素数量不能少于${min}个`);
                }
                if (max !== null && max > 0 && convertedValue.length > max) {
                    errors.push(`${name || '值'}元素数量不能超过${max}个`);
                }
                if (regexp && regexp.trim() !== '') {
                    try {
                        const regExp = getCompiledRegex(regexp);
                        for (const item of convertedValue) {
                            if (!regExp.test(String(item))) {
                                errors.push(`${name || '值'}的元素格式不正确`);
                                break;
                            }
                        }
                    } catch {
                        errors.push(`${name || '值'}的正则表达式格式错误`);
                    }
                }
                break;
        }

        return {
            valid: errors.length === 0,
            value: errors.length === 0 ? convertedValue : null,
            errors
        };
    }

    /**
     * 静态方法：快速验证
     */
    static validate(data: Record<string, any>, rules: TableDefinition, required?: string[]): ValidationResult;
    static validate(value: any, fieldDef: FieldDefinition): { valid: boolean; value: any; errors: string[] };
    static validate(dataOrValue: any, rulesOrFieldDef: any, required?: string[]): any {
        const validator = new Validator();

        if (rulesOrFieldDef && 'type' in rulesOrFieldDef) {
            return validator.validateSingleValue(dataOrValue, rulesOrFieldDef);
        }

        return validator.validate(dataOrValue, rulesOrFieldDef, required || []);
    }

    /**
     * 检查验证是否通过
     */
    static isPassed(result: ValidationResult | { valid: boolean; value: any; errors: string[] }): boolean {
        if ('valid' in result) {
            return result.valid === true;
        }
        return result.code === 0;
    }

    /**
     * 检查验证是否失败
     */
    static isFailed(result: ValidationResult): boolean {
        return result.code === 1;
    }

    /**
     * 获取第一个错误信息
     */
    static getFirstError(result: ValidationResult | { valid: boolean; value: any; errors: string[] }): string | null {
        if ('valid' in result) {
            return result.errors.length > 0 ? result.errors[0] : null;
        }
        if (result.code === 0) return null;
        if (!result.fields) return null;
        const errors = Object.values(result.fields);
        return errors.length > 0 ? errors[0] : null;
    }

    /**
     * 获取所有错误信息
     */
    static getAllErrors(result: ValidationResult | { valid: boolean; value: any; errors: string[] }): string[] {
        if ('valid' in result) {
            return result.errors;
        }
        if (result.code === 0) return [];
        if (!result.fields) return [];
        return Object.values(result.fields);
    }

    /**
     * 获取错误字段列表
     */
    static getErrorFields(result: ValidationResult): string[] {
        return result.code === 0 ? [] : Object.keys(result.fields);
    }
}
