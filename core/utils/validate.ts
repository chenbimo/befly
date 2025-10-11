/**
 * 数据验证器 - TypeScript 版本
 * 提供类型安全的字段验证功能
 */

import { isType, parseRule } from './index.js';
import type { TableDefinition, FieldRule } from '../types/common.js';
import type { ValidationResult, ParsedFieldRule, ValidationError } from '../types/validator';

/**
 * 验证器类
 */
export class Validator {
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
        if (!data || typeof data !== 'object') {
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
                const ruleParts = parseRule(rules[fieldName] || '');
                const fieldLabel = ruleParts.label || fieldName;
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
            const error = this.validateFieldValue(value, rule, fieldName);

            if (error) {
                result.code = 1;
                result.fields[fieldName] = error;
            }
        }
    }

    /**
     * 验证单个字段的值
     */
    private validateFieldValue(value: any, rule: FieldRule, fieldName: string): ValidationError {
        const parsed = parseRule(rule);
        const { label, type, min, max, regex } = parsed;

        switch (type.toLowerCase()) {
            case 'number':
                return this.validateNumber(value, label, min, max, regex, fieldName);
            case 'string':
                return this.validateString(value, label, min, max, regex, fieldName);
            case 'text':
                return this.validateString(value, label, min, max, regex, fieldName);
            case 'array':
                return this.validateArray(value, label, min, max, regex, fieldName);
            default:
                return `字段 ${fieldName} 的类型 ${type} 不支持`;
        }
    }

    /**
     * 验证数字类型
     */
    private validateNumber(value: any, name: string, min: number | null, max: number | null, spec: string | null, fieldName: string): ValidationError {
        try {
            if (isType(value, 'number') === false) {
                return `${name}(${fieldName})必须是数字`;
            }

            if (min !== null && value < min) {
                return `${name}(${fieldName})不能小于${min}`;
            }

            if (max !== null && max > 0 && value > max) {
                return `${name}(${fieldName})不能大于${max}`;
            }

            if (spec && spec.trim() !== '') {
                try {
                    const regExp = new RegExp(spec);
                    if (!regExp.test(String(value))) {
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
            if (isType(value, 'string') === false) {
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
                    const regExp = new RegExp(spec);
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
                    const regExp = new RegExp(spec);
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
     * 快速验证（静态方法）
     * @param data - 要验证的数据
     * @param rules - 验证规则
     * @param required - 必填字段
     * @returns 验证结果
     */
    static validate(data: Record<string, any>, rules: TableDefinition, required?: string[]): ValidationResult;
    static validate(value: any, rule: string): { valid: boolean; value: any; errors: string[] };
    static validate(dataOrValue: any, rulesOrRule: any, required: string[] = []): any {
        // 如果第二个参数是字符串，则是单值验证
        if (typeof rulesOrRule === 'string') {
            return Validator.validateSingleValue(dataOrValue, rulesOrRule);
        }
        // 否则是对象验证
        return validator.validate(dataOrValue, rulesOrRule, required);
    }

    /**
     * 验证单个值（静态方法）
     * @param value - 要验证的值
     * @param rule - 验证规则字符串
     * @returns 验证结果 { valid: boolean, value: any, errors: string[] }
     */
    static validateSingleValue(value: any, rule: string): { valid: boolean; value: any; errors: string[] } {
        const parsed = parseRule(rule);
        const { label, type, min, max, regex, default: defaultValue } = parsed;

        // 处理 undefined/null 值，使用默认值
        if (value === undefined || value === null) {
            if (defaultValue !== 'null' && defaultValue !== null) {
                // 特殊处理数组类型的默认值字符串
                if (type === 'array' && typeof defaultValue === 'string') {
                    if (defaultValue === '[]') {
                        return { valid: true, value: [], errors: [] };
                    }
                    // 尝试解析 JSON 格式的数组字符串
                    try {
                        const parsedArray = JSON.parse(defaultValue);
                        if (Array.isArray(parsedArray)) {
                            return { valid: true, value: parsedArray, errors: [] };
                        }
                    } catch {
                        // 解析失败，使用空数组
                        return { valid: true, value: [], errors: [] };
                    }
                }
                return { valid: true, value: defaultValue, errors: [] };
            }
            // 如果没有默认值，根据类型返回默认值
            if (type === 'number') {
                return { valid: true, value: 0, errors: [] };
            } else if (type === 'array') {
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
                errors.push(`${label || '值'}必须是有效的数字`);
                return { valid: false, value: null, errors };
            }
        }

        // 类型验证
        switch (type.toLowerCase()) {
            case 'number':
                if (!isType(convertedValue, 'number')) {
                    errors.push(`${label || '值'}必须是数字`);
                }
                if (min !== null && convertedValue < min) {
                    errors.push(`${label || '值'}不能小于${min}`);
                }
                if (max !== null && max > 0 && convertedValue > max) {
                    errors.push(`${label || '值'}不能大于${max}`);
                }
                if (regex && regex.trim() !== '' && regex !== 'null') {
                    try {
                        const regExp = new RegExp(regex);
                        if (!regExp.test(String(convertedValue))) {
                            errors.push(`${label || '值'}格式不正确`);
                        }
                    } catch {
                        errors.push(`${label || '值'}的正则表达式格式错误`);
                    }
                }
                break;

            case 'string':
            case 'text':
                if (!isType(convertedValue, 'string')) {
                    errors.push(`${label || '值'}必须是字符串`);
                }
                if (min !== null && convertedValue.length < min) {
                    errors.push(`${label || '值'}长度不能少于${min}个字符`);
                }
                if (max !== null && max > 0 && convertedValue.length > max) {
                    errors.push(`${label || '值'}长度不能超过${max}个字符`);
                }
                if (regex && regex.trim() !== '' && regex !== 'null') {
                    try {
                        const regExp = new RegExp(regex);
                        if (!regExp.test(convertedValue)) {
                            errors.push(`${label || '值'}格式不正确`);
                        }
                    } catch {
                        errors.push(`${label || '值'}的正则表达式格式错误`);
                    }
                }
                break;

            case 'array':
                if (!Array.isArray(convertedValue)) {
                    errors.push(`${label || '值'}必须是数组`);
                }
                if (min !== null && convertedValue.length < min) {
                    errors.push(`${label || '值'}元素数量不能少于${min}个`);
                }
                if (max !== null && max > 0 && convertedValue.length > max) {
                    errors.push(`${label || '值'}元素数量不能超过${max}个`);
                }
                if (regex && regex.trim() !== '' && regex !== 'null') {
                    try {
                        const regExp = new RegExp(regex);
                        for (const item of convertedValue) {
                            if (!regExp.test(String(item))) {
                                errors.push(`${label || '值'}的元素格式不正确`);
                                break;
                            }
                        }
                    } catch {
                        errors.push(`${label || '值'}的正则表达式格式错误`);
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
     * 检查验证是否通过
     * @param result - 验证结果
     * @returns 是否通过
     */
    static isPassed(result: ValidationResult | { valid: boolean; value: any; errors: string[] }): boolean {
        // 支持两种结果格式
        if ('valid' in result) {
            return result.valid === true;
        }
        return result.code === 0;
    }

    /**
     * 检查验证是否失败
     * @param result - 验证结果
     * @returns 是否失败
     */
    static isFailed(result: ValidationResult): boolean {
        return result.code === 1;
    }

    /**
     * 获取第一个错误信息
     * @param result - 验证结果
     * @returns 错误信息
     */
    static getFirstError(result: ValidationResult | { valid: boolean; value: any; errors: string[] }): string | null {
        // 单值验证结果
        if ('valid' in result) {
            return result.errors.length > 0 ? result.errors[0] : null;
        }
        // 对象验证结果
        if (result.code === 0) return null;
        if (!result.fields) return null;
        const errors = Object.values(result.fields);
        return errors.length > 0 ? errors[0] : null;
    }

    /**
     * 获取所有错误信息
     * @param result - 验证结果
     * @returns 错误信息数组
     */
    static getAllErrors(result: ValidationResult | { valid: boolean; value: any; errors: string[] }): string[] {
        // 单值验证结果
        if ('valid' in result) {
            return result.errors;
        }
        // 对象验证结果
        if (result.code === 0) return [];
        if (!result.fields) return [];
        return Object.values(result.fields);
    }

    /**
     * 获取错误字段列表
     * @param result - 验证结果
     * @returns 错误字段名数组
     */
    static getErrorFields(result: ValidationResult): string[] {
        return result.code === 0 ? [] : Object.keys(result.fields);
    }
}

/**
 * 导出验证器实例
 */
export const validator = new Validator();
