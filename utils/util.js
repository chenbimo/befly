import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Env } from '../config/env.js';

export const setCorsOptions = (req) => {
    return {
        headers: {
            'Access-Control-Allow-Origin': Env.ALLOWED_ORIGIN || req.headers.get('origin') || '*',
            'Access-Control-Allow-Methods': Env.ALLOWED_METHODS || 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': Env.ALLOWED_HEADERS || 'Content-Type, Authorization, authorization, token',
            'Access-Control-Expose-Headers': Env.EXPOSE_HEADERS || 'Content-Range, X-Content-Range, Authorization, authorization, token',
            'Access-Control-Max-Age': Env.MAX_AGE || 86400,
            'Access-Control-Allow-Credentials': Env.ALLOW_CREDENTIALS || 'true'
        }
    };
};

export const sortPlugins = (plugins) => {
    const result = [];
    const visited = new Set();
    const visiting = new Set();
    const pluginMap = Object.fromEntries(plugins.map((p) => [p.pluginName, p]));
    let isPass = true;
    const visit = (name) => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            isPass = false;
            return;
        }

        const plugin = pluginMap[name];
        if (!plugin) return; // 依赖不存在时跳过

        visiting.add(name);
        (plugin.after || []).forEach(visit);
        visiting.delete(name);
        visited.add(name);
        result.push(plugin);
    };

    plugins.forEach((p) => visit(p.pluginName));
    return isPass ? result : false;
};

// 规则分割
export const ruleSplit = (rule) => {
    const allParts = rule.split(',');

    // 如果部分数量小于等于5，直接返回
    if (allParts.length <= 5) {
        return allParts;
    }

    // 只取前4个部分，剩余的都合并为第5个部分
    return [allParts[0], allParts[1], allParts[2], allParts[3], allParts.slice(4).join(',')];
};

export const formatDate = (date = new Date(), format = 'YYYY-MM-DD HH:mm:ss') => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');

    return format.replace('YYYY', year).replace('MM', month).replace('DD', day).replace('HH', hour).replace('mm', minute).replace('ss', second);
};

/**
 * 计算时间差并返回带单位的字符串
 * @param {number} startTime - 开始时间（Bun.nanoseconds()返回值）
 * @param {number} endTime - 结束时间（可选，默认为当前时间）
 * @returns {string} 时间差（如果小于1秒返回"xx 毫秒"，否则返回"xx 秒"）
 */
export const calculateElapsedTime = (startTime, endTime = Bun.nanoseconds()) => {
    const elapsedMs = (endTime - startTime) / 1_000_000;

    if (elapsedMs < 1000) {
        return `${elapsedMs.toFixed(2)} 毫秒`;
    } else {
        const elapsedSeconds = elapsedMs / 1000;
        return `${elapsedSeconds.toFixed(2)} 秒`;
    }
};

// 类型判断
export const isType = (value, type) => {
    const actualType = Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
    const expectedType = type.toLowerCase();

    // 特殊类型处理
    switch (expectedType) {
        case 'null':
            return value === null;
        case 'undefined':
            return value === undefined;
        case 'nan':
            return Number.isNaN(value);
        case 'empty':
            return value === '' || value === null || value === undefined;
        case 'integer':
            return Number.isInteger(value);
        case 'float':
            return typeof value === 'number' && !Number.isInteger(value) && !Number.isNaN(value);
        case 'positive':
            return typeof value === 'number' && value > 0;
        case 'negative':
            return typeof value === 'number' && value < 0;
        case 'zero':
            return value === 0;
        case 'truthy':
            return !!value;
        case 'falsy':
            return !value;
        case 'primitive':
            return value !== Object(value);
        case 'reference':
            return value === Object(value);
        case 'function':
            return typeof value === 'function';
        default:
            return actualType === expectedType;
    }
};

export const pickFields = (obj, keys) => {
    if (!obj || typeof obj !== 'object') {
        return {};
    }

    const result = {};

    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }

    return result;
};

export const omitFields = (obj, keys) => {
    if (!obj || typeof obj !== 'object' || !Array.isArray(keys)) {
        return {};
    }

    const result = {};

    for (const key in obj) {
        if (obj.hasOwnProperty(key) && !keys.includes(key)) {
            result[key] = obj[key];
        }
    }

    return result;
};

export const isEmptyObject = (obj) => {
    // 首先检查是否为对象
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return false;
    }

    // 检查是否为空对象
    return Object.keys(obj).length === 0;
};

export const isEmptyArray = (arr) => {
    // 首先检查是否为数组
    if (!Array.isArray(arr)) {
        return false;
    }

    // 检查是否为空数组
    return arr.length === 0;
};

// 返回结果
export const RYes = (msg = '', data = {}, other = {}) => {
    return {
        ...other,
        code: 0,
        msg: msg,
        data: data
    };
};

export const RNo = (msg = '', data = {}, other = {}) => {
    return {
        ...other,
        code: 1,
        msg: msg,
        data: data
    };
};

export const filename2 = (importMetaUrl) => {
    return fileURLToPath(importMetaUrl);
};

export const dirname2 = (importMetaUrl) => {
    return path.dirname(fileURLToPath(importMetaUrl));
};

// 过滤日志字段的函数
export const filterLogFields = (body, excludeFields = '') => {
    if (!body || typeof body !== 'object') return body;

    // 如果是字符串，按逗号分割并清理空格
    const fieldsArray = excludeFields
        .split(',')
        .map((field) => field.trim())
        .filter((field) => field.length > 0);

    // 创建新对象，只包含不在排除列表中的字段
    const filtered = {};
    for (const [key, value] of Object.entries(body)) {
        if (!fieldsArray.includes(key)) {
            filtered[key] = value;
        }
    }
    return filtered;
};

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
export const parseFieldRule = (rule) => {
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
