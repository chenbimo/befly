/**
 * 数据验证器 - TypeScript 版本
 * 提供类型安全的字段验证功能
 */

import { isType, parseRule } from './index.js';
import type { ValidationResult, ParsedFieldRule, TableDefinition, FieldRule } from '../types/common.js';

/**
 * 字段验证错误信息
 */
type ValidationError = string | null;

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
    static validate(data: Record<string, any>, rules: TableDefinition, required: string[] = []): ValidationResult {
        return validator.validate(data, rules, required);
    }

    /**
     * 检查验证是否通过
     * @param result - 验证结果
     * @returns 是否通过
     */
    static isPassed(result: ValidationResult): boolean {
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
    static getFirstError(result: ValidationResult): string | null {
        if (result.code === 0) return null;
        const errors = Object.values(result.fields);
        return errors.length > 0 ? errors[0] : null;
    }

    /**
     * 获取所有错误信息
     * @param result - 验证结果
     * @returns 错误信息数组
     */
    static getAllErrors(result: ValidationResult): string[] {
        return result.code === 0 ? [] : Object.values(result.fields);
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
