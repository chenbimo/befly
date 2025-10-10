/**
 * Befly 工具函数集 - TypeScript 版本
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SQL } from 'bun';
import { Env } from '../config/env.js';
import { Logger } from './logger.js';
import type { Plugin } from '../types/plugin.js';
import type { ParsedFieldRule, KeyValue } from '../types/common.js';

/**
 * 设置 CORS 选项
 */
export const setCorsOptions = (req: Request) => {
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

/**
 * 排序插件（根据依赖关系）
 */
export const sortPlugins = (plugins: Plugin[]): Plugin[] | false => {
    const result: Plugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const pluginMap: Record<string, Plugin> = Object.fromEntries(plugins.map((p) => [p.name, p]));
    let isPass = true;

    const visit = (name: string): void => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            isPass = false;
            return;
        }

        const plugin = pluginMap[name];
        if (!plugin) return; // 依赖不存在时跳过

        visiting.add(name);
        (plugin.dependencies || []).forEach(visit);
        visiting.delete(name);
        visited.add(name);
        result.push(plugin);
    };

    plugins.forEach((p) => visit(p.name));
    return isPass ? result : false;
};

/**
 * 解析字段规则字符串（以 ⚡ 分隔）
 * 返回：显示名, 类型, 最小值, 最大值, 默认值, 是否索引, 正则
 */
export const parseRule = (rule: string): ParsedFieldRule => {
    const parts = rule.split('⚡');
    const [fieldName = '', fieldType = 'string', fieldMinStr = 'null', fieldMaxStr = 'null', fieldDefaultStr = 'null', fieldIndexStr = '0', fieldRegx = 'null'] = parts;

    const fieldIndex = Number(fieldIndexStr) as 0 | 1;
    const fieldMin = fieldMinStr !== 'null' ? Number(fieldMinStr) : null;
    const fieldMax = fieldMaxStr !== 'null' ? Number(fieldMaxStr) : null;

    let fieldDefault: any = fieldDefaultStr;
    if (fieldType === 'number' && fieldDefaultStr !== 'null') {
        fieldDefault = Number(fieldDefaultStr);
    }

    return {
        label: fieldName,
        type: fieldType as 'string' | 'number' | 'text' | 'array',
        min: fieldMin,
        max: fieldMax,
        default: fieldDefault,
        index: fieldIndex,
        regex: fieldRegx !== 'null' ? fieldRegx : null
    };
};

/**
 * 格式化日期
 */
export const formatDate = (date: Date | string | number = new Date(), format: string = 'YYYY-MM-DD HH:mm:ss'): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');

    return format.replace('YYYY', String(year)).replace('MM', month).replace('DD', day).replace('HH', hour).replace('mm', minute).replace('ss', second);
};

/**
 * 计算性能时间差
 * @param startTime - 开始时间（Bun.nanoseconds()返回值）
 * @param endTime - 结束时间（可选，默认为当前时间）
 * @returns 时间差（毫秒或秒）
 */
export const calcPerfTime = (startTime: number, endTime: number = Bun.nanoseconds()): string => {
    const elapsedMs = (endTime - startTime) / 1_000_000;

    if (elapsedMs < 1000) {
        return `${elapsedMs.toFixed(2)} 毫秒`;
    } else {
        const elapsedSeconds = elapsedMs / 1000;
        return `${elapsedSeconds.toFixed(2)} 秒`;
    }
};

/**
 * 类型判断
 */
export const isType = (value: any, type: string): boolean => {
    const actualType = Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
    const expectedType = String(type).toLowerCase();

    // 语义类型单独处理
    switch (expectedType) {
        case 'function':
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

/**
 * 挑选指定字段
 */
export const pickFields = <T extends Record<string, any>>(obj: T, keys: string[]): Partial<T> => {
    if (!obj || (!isType(obj, 'object') && !isType(obj, 'array'))) {
        return {};
    }

    const result: any = {};
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }

    return result;
};

/**
 * 排除指定字段和值
 */
export const omitFields = <T = any>(data: T, excludeKeys: string[] = [], excludeValues: any[] = []): T | Partial<T> => {
    const shouldDropValue = (v: any): boolean => excludeValues.some((x) => x === v);

    const cleanObject = (obj: any): any => {
        if (!isType(obj, 'object')) return obj;
        const result: any = {};
        for (const [k, v] of Object.entries(obj)) {
            if (excludeKeys.includes(k)) continue;
            if (shouldDropValue(v)) continue;
            result[k] = v;
        }
        return result;
    };

    if (isType(data, 'array')) {
        return (data as any).filter((item: any) => !shouldDropValue(item)).map((item: any) => (isType(item, 'object') ? cleanObject(item) : item));
    }

    if (isType(data, 'object')) {
        return cleanObject(data);
    }

    return data;
};

/**
 * 判断是否为空对象
 */
export const isEmptyObject = (obj: any): boolean => {
    if (!isType(obj, 'object')) {
        return false;
    }
    return Object.keys(obj).length === 0;
};

/**
 * 判断是否为空数组
 */
export const isEmptyArray = (arr: any): boolean => {
    if (!isType(arr, 'array')) {
        return false;
    }
    return arr.length === 0;
};

/**
 * 成功响应
 */
export const Yes = <T = any>(msg: string = '', data: T | {} = {}, other: KeyValue = {}): { code: 0; msg: string; data: T | {} } & KeyValue => {
    return {
        ...other,
        code: 0,
        msg: msg,
        data: data
    };
};

/**
 * 失败响应
 */
export const No = <T = any>(msg: string = '', data: T | {} = {}, other: KeyValue = {}): { code: 1; msg: string; data: T | {} } & KeyValue => {
    return {
        ...other,
        code: 1,
        msg: msg,
        data: data
    };
};

/**
 * 获取文件路径
 */
export const filename2 = (importMetaUrl: string): string => {
    return fileURLToPath(importMetaUrl);
};

/**
 * 获取目录路径
 */
export const dirname2 = (importMetaUrl: string): string => {
    return path.dirname(fileURLToPath(importMetaUrl));
};

/**
 * 过滤日志字段
 */
export const filterLogFields = (body: any, excludeFields: string = ''): any => {
    if (!body || (!isType(body, 'object') && !isType(body, 'array'))) return body;

    const fieldsArray = excludeFields
        .split(',')
        .map((field) => field.trim())
        .filter((field) => field.length > 0);

    const filtered: any = {};
    for (const [key, value] of Object.entries(body)) {
        if (!fieldsArray.includes(key)) {
            filtered[key] = value;
        }
    }
    return filtered;
};

/**
 * 转换为蛇形命名（snake_case）
 * userTable -> user_table
 */
export const toSnakeTableName = (name: string): string => {
    if (!name) return name;
    return String(name)
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1_$2')
        .toLowerCase();
};

/**
 * 构建数据库连接字符串
 */
export const buildDatabaseUrl = (): string => {
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

/**
 * 创建 SQL 客户端
 */
export interface SqlClientOptions {
    max?: number;
    bigint?: boolean;
    [key: string]: any;
}

export async function createSqlClient(options: SqlClientOptions = {}): Promise<any> {
    const finalUrl = buildDatabaseUrl();
    let sql: any = null;

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
        // 连接健康检查
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

// 导出其他模块
export { Colors } from './colors.js';
export { Logger } from './logger.js';
export { Validator } from './validate.js';
export { SqlBuilder } from './sqlBuilder.js';
export { SqlManager } from './sqlManager.js';
export type { QueryOptions, InsertOptions, UpdateOptions, DeleteOptions, ListResult, TransactionCallback } from './sqlManager.js';
export { RedisHelper, setRedisClient, getRedisClient } from './redisHelper.js';
export { Jwt } from './jwt.js';
export type { JwtPayload } from './jwt.js';
export { Crypto } from './crypto.js';
export type { EncodingType, HashAlgorithm } from './crypto.js';
export { Xml } from './xml.js';
export type { XmlParseOptions } from './xml.js';
export { Api, GET, POST, PUT, DELETE, PATCH, OPTIONS } from './api.js';
export type { FieldRules } from './api.js';
export { Tool } from './tool.js';
