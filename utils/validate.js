import { isType } from './util.js';

// 专门用于处理管道符分隔的字段规则
const parseFieldRule = (rule) => {
    const allParts = rule.split('|');

    // 现在支持7个部分：显示名|类型|最小值|最大值|默认值|是否索引|正则约束
    if (allParts.length <= 7) {
        // 如果少于7个部分，补齐缺失的部分为 null
        while (allParts.length < 7) {
            allParts.push('null');
        }
        return allParts;
    }

    // 如果超过7个部分，保留前6个，剩余的合并为最后的正则约束部分
    return [
        allParts[0], // 显示名
        allParts[1], // 类型
        allParts[2], // 最小值
        allParts[3], // 最大值
        allParts[4], // 默认值
        allParts[5], // 是否索引
        allParts.slice(6).join('|') // 正则约束（可能包含管道符）
    ];
};

/**
 * 验证器类
 */
export class Validator {
    /**
     * 验证数据
     * @param {Object} data - 要验证的数据对象
     * @param {Object} rules - 验证规则对象
     * @param {Array} required - 必传字段数组
     * @returns {Object} { code: 0|1, fields: {} }
     */
    validate(data, rules, required = []) {
        const result = {
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
    checkParams(data, rules, required, result) {
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
    checkRequiredFields(data, rules, required, result) {
        for (const fieldName of required) {
            if (!(fieldName in data) || data[fieldName] === undefined || data[fieldName] === null || data[fieldName] === '') {
                result.code = 1;
                const ruleParts = parseFieldRule(rules[fieldName] || '');
                const fieldLabel = ruleParts[0] || fieldName;
                result.fields[fieldName] = `${fieldLabel}(${fieldName})为必填项`;
            }
        }
    }

    /**
     * 验证所有字段
     */
    validateFields(data, rules, required, result) {
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
    validateFieldValue(value, rule, fieldName) {
        const [name, type, minStr, maxStr, defaultValue, isIndexStr, regexConstraint] = parseFieldRule(rule);
        const min = minStr === 'null' ? null : parseInt(minStr) || 0;
        const max = maxStr === 'null' ? null : parseInt(maxStr) || 0;
        const spec = regexConstraint === 'null' ? null : regexConstraint.trim();

        switch (type.toLowerCase()) {
            case 'number':
                return this.validateNumber(value, name, min, max, spec, fieldName);
            case 'string':
                return this.validateString(value, name, min, max, spec, fieldName);
            case 'text':
                return this.validateString(value, name, min, max, spec, fieldName);
            case 'array':
                return this.validateArray(value, name, min, max, spec, fieldName);
            default:
                return `字段 ${fieldName} 的类型 ${type} 不支持`;
        }
    }

    /**
     * 验证数字类型
     */
    validateNumber(value, name, min, max, spec, fieldName) {
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
                // 检查是否为枚举格式
                if (this.isEnumSpec(spec)) {
                    return this.validateEnum(value, spec, name, fieldName, 'number');
                } else {
                    // 正则表达式验证
                    try {
                        const regExp = new RegExp(spec);
                        if (!regExp.test(String(value))) {
                            return `${name}(${fieldName})格式不正确`;
                        }
                    } catch (error) {
                        return `${name}(${fieldName})的正则表达式格式错误`;
                    }
                }
            }

            return null;
        } catch (error) {
            return `${name}(${fieldName})验证出错: ${error.message}`;
        }
    }

    /**
     * 判断是否为枚举格式
     */
    isEnumSpec(spec) {
        return spec && spec.startsWith('enum#');
    }

    /**
     * 验证枚举值
     */
    validateEnum(value, spec, name, fieldName, type) {
        // 解析枚举值 "enum#1,2,3" -> ["1", "2", "3"]
        const enumValues = spec
            .substring(5)
            .split(',')
            .map((v) => v.trim());

        if (type === 'number') {
            // 数字类型：转换枚举值为数字进行比较
            const numericEnumValues = enumValues.map((v) => parseFloat(v));
            if (!numericEnumValues.includes(value)) {
                return `${name}(${fieldName})必须是以下值之一: ${enumValues.join(', ')}`;
            }
        } else if (type === 'string') {
            // 字符串类型：直接比较
            if (!enumValues.includes(value)) {
                return `${name}(${fieldName})必须是以下值之一: ${enumValues.join(', ')}`;
            }
        } else if (type === 'array') {
            // 数组类型：检查每个元素是否在枚举值中
            for (const item of value) {
                if (!enumValues.includes(String(item))) {
                    return `${name}(${fieldName})中的元素"${item}"必须是以下值之一: ${enumValues.join(', ')}`;
                }
            }
        }

        return null;
    }

    /**
     * 验证字符串类型
     */
    validateString(value, name, min, max, spec, fieldName) {
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
                // 检查是否为枚举格式
                if (this.isEnumSpec(spec)) {
                    return this.validateEnum(value, spec, name, fieldName, 'string');
                } else {
                    // 正则表达式验证
                    try {
                        const regExp = new RegExp(spec);
                        if (!regExp.test(value)) {
                            return `${name}(${fieldName})格式不正确`;
                        }
                    } catch (error) {
                        return `${name}(${fieldName})的正则表达式格式错误`;
                    }
                }
            }

            return null;
        } catch (error) {
            return `${name}(${fieldName})验证出错: ${error.message}`;
        }
    }

    /**
     * 验证数组类型
     */
    validateArray(value, name, min, max, spec, fieldName) {
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
                // 检查是否为枚举格式
                if (this.isEnumSpec(spec)) {
                    return this.validateEnum(value, spec, name, fieldName, 'array');
                } else {
                    // 正则表达式验证
                    try {
                        const regExp = new RegExp(spec);
                        for (const item of value) {
                            if (!regExp.test(String(item))) {
                                return `${name}(${fieldName})中的元素"${item}"格式不正确`;
                            }
                        }
                    } catch (error) {
                        return `${name}(${fieldName})的正则表达式格式错误`;
                    }
                }
            }

            return null;
        } catch (error) {
            return `${name}(${fieldName})验证出错: ${error.message}`;
        }
    }
}

export const validator = new Validator();
