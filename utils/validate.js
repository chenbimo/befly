import { isType } from './util.js';

// 验证字段名称是否为中文、数字、字母
const validateFieldName = (name) => {
    const nameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9]+$/;
    return nameRegex.test(name);
};

// 验证字段类型是否为指定的四种类型之一
const validateFieldType = (type) => {
    const validTypes = ['string', 'number', 'text', 'array'];
    return validTypes.includes(type);
};

// 验证最小值/最大值是否为null或数字
const validateMinMax = (value) => {
    return value === 'null' || (!isNaN(parseFloat(value)) && isFinite(parseFloat(value)));
};

// 验证默认值是否为null、字符串或数字
const validateDefaultValue = (value) => {
    if (value === 'null') return true;
    // 检查是否为数字
    if (!isNaN(parseFloat(value)) && isFinite(parseFloat(value))) return true;
    // 其他情况视为字符串，都是有效的
    return true;
};

// 验证索引标识是否为0或1
const validateIndex = (value) => {
    return value === '0' || value === '1';
};

// 验证正则表达式是否有效
const validateRegex = (value) => {
    if (value === 'null') return true;
    try {
        new RegExp(value);
        return true;
    } catch (e) {
        return false;
    }
};

// 专门用于处理⚡分隔的字段规则
const parseFieldRule = (rule) => {
    const allParts = rule.split('⚡');

    // 必须包含7个部分：显示名⚡类型⚡最小值⚡最大值⚡默认值⚡是否索引⚡正则约束
    if (allParts.length !== 7) {
        throw new Error(`字段规则格式错误，必须包含7个部分，当前包含${allParts.length}个部分`);
    }

    // 验证各个部分的格式
    const [name, type, minValue, maxValue, defaultValue, isIndex, regexConstraint] = allParts;

    // 第1个值：名称必须为中文、数字、字母
    if (!validateFieldName(name)) {
        throw new Error(`字段名称 "${name}" 格式错误，必须为中文、数字、字母`);
    }

    // 第2个值：字段类型必须为string,number,text,array之一
    if (!validateFieldType(type)) {
        throw new Error(`字段类型 "${type}" 格式错误，必须为string、number、text、array之一`);
    }

    // 第3个值：最小值必须为null或数字
    if (!validateMinMax(minValue)) {
        throw new Error(`最小值 "${minValue}" 格式错误，必须为null或数字`);
    }

    // 第4个值：最大值必须为null或数字
    if (!validateMinMax(maxValue)) {
        throw new Error(`最大值 "${maxValue}" 格式错误，必须为null或数字`);
    }

    // 第5个值：默认值必须为null、字符串或数字
    if (!validateDefaultValue(defaultValue)) {
        throw new Error(`默认值 "${defaultValue}" 格式错误，必须为null、字符串或数字`);
    }

    // 第6个值：是否创建索引必须为0或1
    if (!validateIndex(isIndex)) {
        throw new Error(`索引标识 "${isIndex}" 格式错误，必须为0或1`);
    }

    // 第7个值：必须为null或正则表达式
    if (!validateRegex(regexConstraint)) {
        throw new Error(`正则约束 "${regexConstraint}" 格式错误，必须为null或有效的正则表达式`);
    }

    return allParts;
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
                try {
                    const regExp = new RegExp(spec);
                    if (!regExp.test(String(value))) {
                        return `${name}(${fieldName})格式不正确`;
                    }
                } catch (error) {
                    return `${name}(${fieldName})的正则表达式格式错误`;
                }
            }

            return null;
        } catch (error) {
            return `${name}(${fieldName})验证出错: ${error.message}`;
        }
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
                try {
                    const regExp = new RegExp(spec);
                    if (!regExp.test(value)) {
                        return `${name}(${fieldName})格式不正确`;
                    }
                } catch (error) {
                    return `${name}(${fieldName})的正则表达式格式错误`;
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

            return null;
        } catch (error) {
            return `${name}(${fieldName})验证出错: ${error.message}`;
        }
    }
}

export const validator = new Validator();
