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

/**
 * 解析字段规则字符串（以 ⚡ 分隔），并进行最小类型转换：
 * - 返回顺序：显示名, 类型, 最小值, 最大值, 默认值, 是否索引, 正则
 * - 最小值/最大值/是否索引：当不为字面量字符串 'null' 时转为数字；否则保留原值
 * - 默认值：当类型为 number 且默认值不为 'null' 时转为数字；否则保留原值
 * - 不做正确性校验（由 checks/table.js 负责）
 * - 保留额外段位（>7）以便上层可检测异常长度
 *
 * @param {string} rule
 * @returns {any[]} 一个数组，至少包含前7段（若原始段位不足则按原样长度返回），多余段位将原样附加
 */
export const parseRule = (rule) => {
    let [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = rule.split('⚡');

    fieldIndex = Number(fieldIndex);
    if (fieldMin !== 'null') fieldMin = Number(fieldMin);
    if (fieldMax !== 'null') fieldMax = Number(fieldMax);
    if (fieldType !== 'number') fieldDefault = Number(fieldDefault);

    return [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx];
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
    const expectedType = String(type).toLowerCase();

    // 语义类型单独处理，其余走 actualType === expectedType
    switch (expectedType) {
        case 'function':
            // 统一将普通函数、异步函数、生成器函数等都识别为函数
            return typeof value === 'function';
        case 'nan':
            return typeof value === 'number' && Number.isNaN(value);
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
        return data.filter((item) => !shouldDropValue(item)).map((item) => (isType(item, 'object') ? cleanObject(item) : item));
    }

    if (isType(data, 'object')) {
        return cleanObject(data);
    }

    // 非对象/数组则原样返回（不处理）
    return data;
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
export const Yes = (msg = '', data = {}, other = {}) => {
    return {
        ...other,
        code: 0,
        msg: msg,
        data: data
    };
};

export const No = (msg = '', data = {}, other = {}) => {
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

// 将 lowerCamelCase 或单词形式转换为下划线风格（snake_case）
// 例如：userTable -> user_table, testNewFormat -> test_new_format, users -> users, orderV2 -> order_v2
export const toSnakeTableName = (name) => {
    if (!name) return name;
    return String(name)
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1_$2')
        .toLowerCase();
};

/**
 * 创建并校验 Bun SQL 客户端
 * - 连接成功后返回 SQL 实例，失败会自动 close 并抛出
 * @param {object} options 传给 new SQL 的参数（如 { max: 1, bigint: true }）
 */

// 组合最终数据库连接串：
// - 基于 DB_* 环境变量构建（DB_TYPE/DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME）
// - sqlite: sqlite:<DB_NAME>（文件路径或 :memory:）
// - postgresql: postgres://[user:pass@]host:port/DB_NAME
// - mysql: mysql://[user:pass@]host:port/DB_NAME
export const buildDatabaseUrl = () => {
    const type = Env.DB_TYPE || '';
    const host = Env.DB_HOST || '';
    const port = Env.DB_PORT;
    const user = encodeURIComponent(Env.DB_USER || '');
    const pass = encodeURIComponent(Env.DB_PASS || '');
    const name = Env.DB_NAME || '';

    if (!type) throw new Error('DB_TYPE 未配置');
    if (!name && type !== 'sqlite') throw new Error('DB_NAME 未配置');

    if (type === 'sqlite') {
        if (!name) throw new Error('DB_NAME 未配置');
        return `sqlite://${name}`;
    }

    if (type === 'postgresql' || type === 'postgres') {
        if (!host || !port) throw new Error('DB_HOST/DB_PORT 未配置');
        const auth = user || pass ? `${user}:${pass}@` : '';
        return `postgres://${auth}${host}:${port}/${encodeURIComponent(name)}`;
    }

    if (type === 'mysql') {
        if (!host || !port) throw new Error('DB_HOST/DB_PORT 未配置');
        const auth = user || pass ? `${user}:${pass}@` : '';
        return `mysql://${auth}${host}:${port}/${encodeURIComponent(name)}`;
    }

    throw new Error(`不支持的 DB_TYPE: ${type}`);
};

export async function createSqlClient(options = {}) {
    const finalUrl = buildDatabaseUrl();
    let sql = null;
    if (Env.DB_TYPE === 'sqlite') {
        sql = new SQL(finalUrl);
    } else {
        sql = new SQL({
            url: finalUrl,
            max: options.max ?? 1,
            bigint: options.bigint ?? true,
            ...options
        });
    }

    try {
        // 连接健康检查：按协议选择
        let version = '';
        if (Env.DB_TYPE === 'sqlite') {
            const v = await sql`SELECT sqlite_version() AS version`;
            version = v?.[0]?.version;
        } else if (Env.DB_TYPE === 'postgresql' || Env.DB_TYPE === 'postgres') {
            const v = await sql`SELECT version() AS version`;
            version = v?.[0]?.version;
        } else {
            const v = await sql`SELECT VERSION() AS version`;
            version = v?.[0]?.version;
        }
        Logger.info(`数据库连接成功，version: ${version}`);
        return sql;
    } catch (error) {
        Logger.error('数据库连接测试失败:', error);
        try {
            await sql.close();
        } catch {}
        throw error;
    }
}
