/**
 * 数据验证器 - 通用库版本
 * 提供类型安全的字段验证功能（无框架依赖）
 */

import type { TableDefinition, FieldRule, ParsedFieldRule } from '../types/common.js';
import type { ValidationResult, ValidationError } from '../types/validator';

/**
 * 解析字段规则字符串（类型定义）
 */
export type ParseRuleFunction = (rule: string) => ParsedFieldRule;

/**
 * 内置正则表达式别名
 */
export const DEFAULT_REGEX_ALIASES = {
    // 数字类型
    number: '^\\d+$',
    integer: '^-?\\d+$',
    float: '^-?\\d+(\\.\\d+)?$',
    positive: '^[1-9]\\d*$',

    // 字符串类型
    word: '^[a-zA-Z]+$',
    alphanumeric: '^[a-zA-Z0-9]+$',
    alphanumeric_: '^[a-zA-Z0-9_]+$',
    lowercase: '^[a-z]+$',
    uppercase: '^[A-Z]+$',

    // 中文
    chinese: '^[\\u4e00-\\u9fa5]+$',
    chinese_word: '^[\\u4e00-\\u9fa5a-zA-Z]+$',

    // 常用格式
    email: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    phone: '^1[3-9]\\d{9}$',
    url: '^https?://',
    ip: '^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$',

    // 特殊格式
    uuid: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    hex: '^[0-9a-fA-F]+$',
    base64: '^[A-Za-z0-9+/=]+$',

    // 日期时间
    date: '^\\d{4}-\\d{2}-\\d{2}$',
    time: '^\\d{2}:\\d{2}:\\d{2}$',
    datetime: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',

    // 代码相关
    variable: '^[a-zA-Z_][a-zA-Z0-9_]*$',
    constant: '^[A-Z][A-Z0-9_]*$',

    // 空值
    empty: '^$',
    notempty: '.+'
} as const;

/**
 * 类型检查函数（内部实现）
 */
function isType(value: any, type: string): boolean {
    const valueType = Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
    const types = type.split('|').map((t) => t.trim().toLowerCase());
    return types.includes(valueType);
}

/**
 * 默认的规则解析函数（简化版）
 * 注意：只分割前6个|，第7个|之后的所有内容（包括|）都属于正则表达式
 */
function defaultParseRule(rule: string): ParsedFieldRule {
    if (typeof rule !== 'string') {
        return {
            name: '',
            type: 'string',
            min: null,
            max: null,
            default: null,
            required: 0,
            regex: null
        };
    }

    // 手动分割前6个|，剩余部分作为正则表达式
    const parts: string[] = [];
    let currentPart = '';
    let pipeCount = 0;

    for (let i = 0; i < rule.length; i++) {
        if (rule[i] === '|' && pipeCount < 6) {
            parts.push(currentPart);
            currentPart = '';
            pipeCount++;
        } else {
            currentPart += rule[i];
        }
    }
    parts.push(currentPart);

    const parseNumber = (val: string) => {
        if (!val || val === 'null') return null;
        const num = Number(val);
        return isNaN(num) ? null : num;
    };

    const defaultValue = parts[4];
    let parsedDefault: any = null;
    if (defaultValue && defaultValue !== 'null') {
        // 对于 number 类型，尝试转换为数字
        const type = (parts[1] || 'string').toLowerCase();
        if (type === 'number') {
            const num = Number(defaultValue);
            parsedDefault = isNaN(num) ? defaultValue : num;
        } else {
            parsedDefault = defaultValue;
        }
    }

    return {
        name: parts[0] || '',
        type: (parts[1] || 'string').toLowerCase(),
        min: parseNumber(parts[2]),
        max: parseNumber(parts[3]),
        default: parsedDefault,
        required: parseInt(parts[5]) || 0,
        regex: parts[6] && parts[6] !== 'null' ? parts[6] : null
    };
}

/**
 * 验证器配置接口
 */
export interface ValidatorConfig {
    /** 正则别名映射 */
    regexAliases?: Record<string, string>;
    /** 自定义规则解析函数 */
    parseRule?: ParseRuleFunction;
}

/**
 * 验证器类
 */
export class Validator {
    /** 正则别名映射 */
    private regexAliases: Record<string, string>;
    /** 规则解析函数 */
    private parseRule: ParseRuleFunction;

    constructor(config: ValidatorConfig = {}) {
        this.regexAliases = config.regexAliases || DEFAULT_REGEX_ALIASES;
        this.parseRule = config.parseRule || defaultParseRule;
    }

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
                const ruleParts = this.parseRule(rules[fieldName] || '');
                const fieldLabel = ruleParts.name || fieldName;
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
    private validateFieldValue(value: any, rule: FieldRule, fieldName: string): ValidationError {
        const parsed = this.parseRule(rule);
        let { name, type, min, max, regex } = parsed;

        regex = this.resolveRegexAlias(regex);

        switch (type.toLowerCase()) {
            case 'number':
                return this.validateNumber(value, name, min, max, regex, fieldName);
            case 'string':
            case 'text':
                return this.validateString(value, name, min, max, regex, fieldName);
            case 'array_string':
            case 'array_text':
                return this.validateArray(value, name, min, max, regex, fieldName);
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
     * 验证单个值
     */
    validateSingleValue(value: any, rule: string): { valid: boolean; value: any; errors: string[] } {
        const parsed = this.parseRule(rule);
        let { name, type, min, max, regex, default: defaultValue } = parsed;

        regex = this.resolveRegexAlias(regex);

        // 处理 undefined/null 值，使用默认值
        if (value === undefined || value === null) {
            if (defaultValue !== 'null' && defaultValue !== null) {
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
                if (!isType(convertedValue, 'number')) {
                    errors.push(`${name || '值'}必须是数字`);
                }
                if (min !== null && convertedValue < min) {
                    errors.push(`${name || '值'}不能小于${min}`);
                }
                if (max !== null && max > 0 && convertedValue > max) {
                    errors.push(`${name || '值'}不能大于${max}`);
                }
                if (regex && regex.trim() !== '' && regex !== 'null') {
                    try {
                        const regExp = new RegExp(regex);
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
                if (!isType(convertedValue, 'string')) {
                    errors.push(`${name || '值'}必须是字符串`);
                }
                if (min !== null && convertedValue.length < min) {
                    errors.push(`${name || '值'}长度不能少于${min}个字符`);
                }
                if (max !== null && max > 0 && convertedValue.length > max) {
                    errors.push(`${name || '值'}长度不能超过${max}个字符`);
                }
                if (regex && regex.trim() !== '' && regex !== 'null') {
                    try {
                        const regExp = new RegExp(regex);
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
                if (regex && regex.trim() !== '' && regex !== 'null') {
                    try {
                        const regExp = new RegExp(regex);
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
    static validate(data: Record<string, any>, rules: TableDefinition, required?: string[], config?: ValidatorConfig): ValidationResult;
    static validate(value: any, rule: string, config?: ValidatorConfig): { valid: boolean; value: any; errors: string[] };
    static validate(dataOrValue: any, rulesOrRule: any, requiredOrConfig?: any, config?: ValidatorConfig): any {
        if (typeof rulesOrRule === 'string') {
            const cfg = typeof requiredOrConfig === 'object' && !Array.isArray(requiredOrConfig) ? requiredOrConfig : config;
            const validator = new Validator(cfg);
            return validator.validateSingleValue(dataOrValue, rulesOrRule);
        }

        const required = Array.isArray(requiredOrConfig) ? requiredOrConfig : [];
        const cfg = config || {};
        const validator = new Validator(cfg);
        return validator.validate(dataOrValue, rulesOrRule, required);
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
