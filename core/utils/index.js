import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SQL } from 'bun';
import { Env } from '../config/env.js';
import { Logger } from './logger.js';

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
export const calcPerfTime = (startTime, endTime = Bun.nanoseconds()) => {
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
    // 仅对对象或数组进行字段挑选，其他类型返回空对象（保持原有行为）
    if (!obj || (!isType(obj, 'object') && !isType(obj, 'array'))) {
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

/**
 * 从对象或数组数据中按“字段名”和“字段值”进行排除过滤。
 * - 支持对象：移除指定字段名，以及值在排除值列表中的字段。
 * - 支持数组：
 *   - 如果元素为对象，按同样规则清洗（移除字段名/字段值命中项）。
 *   - 如果元素为原始值（数字/字符串等），当元素值命中排除值则从数组中移除该元素。
 *
 * 约定：excludeKeys 与 excludeValues 均为数组类型。
 *
 * 示例：
 *   omitFields({ a:1, b:undefined, c:null }, ['a'], [undefined]) -> { c:null }
 *   omitFields([{ a:1, b:null }, null, 0], ['a'], [null]) -> [{}, 0]
 *
 * 注意：仅当第一个参数为对象或数组时执行过滤，否则原样返回。
 *
 * @template T
 * @param {Record<string, any> | Array<any>} data - 原始数据（对象或数组）
 * @param {string[]} [excludeKeys=[]] - 要排除的字段名（对象属性名）数组
 * @param {any[]} [excludeValues=[]] - 要排除的字段值数组；当包含 undefined/null 等时，将移除这些值对应的字段或数组元素
 * @returns {T} 过滤后的数据，类型与入参保持一致
 */
export const omitFields = (data, excludeKeys = [], excludeValues = []) => {
    const shouldDropValue = (v) => excludeValues.some((x) => x === v);

    const cleanObject = (obj) => {
        if (!isType(obj, 'object')) return obj;
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
            if (excludeKeys.includes(k)) continue;
            if (shouldDropValue(v)) continue;
            result[k] = v;
        }
        return result;
    };

    if (isType(data, 'array')) {
        return /** @type {any} */ (data.filter((item) => !shouldDropValue(item)).map((item) => (isType(item, 'object') ? cleanObject(item) : item)));
    }

    if (isType(data, 'object')) {
        return /** @type {any} */ (cleanObject(data));
    }

    // 非对象/数组则原样返回（不处理）
    return /** @type {any} */ (data);
};

export const isEmptyObject = (obj) => {
    // 首先检查是否为对象
    if (!isType(obj, 'object')) {
        return false;
    }

    // 检查是否为空对象
    return Object.keys(obj).length === 0;
};

export const isEmptyArray = (arr) => {
    // 首先检查是否为数组
    if (!isType(arr, 'array')) {
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
    // 仅在对象或数组时进行过滤，保持与原 typeof === 'object' 行为一致（数组也会进入）
    if (!body || (!isType(body, 'object') && !isType(body, 'array'))) return body;

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

// 验证字段名称：中文、数字、字母、空格、下划线、短横线
export const validateFieldName = (name) => {
    const nameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9 _-]+$/;
    return nameRegex.test(name);
};

// 验证字段类型是否为指定的四种类型之一
export const validateFieldType = (type) => {
    const validTypes = ['string', 'number', 'text', 'array'];
    return validTypes.includes(type);
};

// 验证最小值/最大值是否为null或数字
export const validateMinMax = (value) => {
    return value === 'null' || (!isNaN(parseFloat(value)) && isFinite(parseFloat(value)));
};

// 验证默认值是否为null、字符串或数字
export const validateDefaultValue = (value) => {
    if (value === 'null') return true;
    // 检查是否为数字
    if (!isNaN(parseFloat(value)) && isFinite(parseFloat(value))) return true;
    // 其他情况视为字符串，都是有效的
    return true;
};

// 验证索引标识是否为0或1
export const validateIndex = (value) => {
    return value === '0' || value === '1';
};

// 验证正则表达式是否有效
export const validateRegex = (value) => {
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

/**
 * 创建并校验 Bun SQL 客户端
 * - 优先使用 Env.MYSQL_URL
 * - 否则按 scripts/syncDb.js 的方式拼接 URL
 * - 连接成功后返回 SQL 实例，失败会自动 close 并抛出
 * @param {object} options 传给 new SQL 的参数（如 { max: 1, bigint: true }）
 */
export async function createSqlClient(options = {}) {
    const url = Env.MYSQL_URL ? Env.MYSQL_URL : `mysql://${encodeURIComponent(Env.MYSQL_USER)}:${encodeURIComponent(Env.MYSQL_PASSWORD)}@${Env.MYSQL_HOST}:${Env.MYSQL_PORT}/${Env.MYSQL_DB}`;

    const sql = new SQL({ url, max: options.max ?? 1, bigint: options.bigint ?? true, ...options });
    try {
        const ver = await sql`SELECT VERSION() AS version`;
        const version = ver?.[0]?.version;
        Logger.info(`数据库连接成功，MySQL 版本: ${version}`);
        return sql;
    } catch (error) {
        Logger.error('数据库连接测试失败:', error);
        try {
            await sql.close();
        } catch {}
        throw error;
    }
}
