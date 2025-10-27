/**
 * Befly 核心工具函数集合
 *
 * 本文件整合了框架所有工具函数和类：
 * - API 响应工具（Yes, No）
 * - 环境判断（isDebug）
 * - 类型判断（isType, isEmptyObject, isEmptyArray）
 * - 对象操作（pickFields, fieldClear, cleanData）
 * - 日期时间（formatDate, calcPerfTime）
 * - 字段转换（toSnakeCase, toCamelCase 等）
 * - Bun 版本检查（checkBunVersion）
 * - JWT 工具（Jwt 类）
 * - Logger 工具（Logger）
 * - Validator 工具（Validator, validator, validate）
 * - Addon 管理（scanAddons, getAddonDir 等）
 * - 数据库管理（buildRedisUrl, buildDatabaseUrl 等）
 * - 插件管理（sortPlugins）
 * - 表定义工具（parseRule）
 * - 请求上下文（RequestContext）
 */

import fs from 'node:fs';
import { join } from 'node:path';
import { SQL, RedisClient } from 'bun';
import { Env } from './config/env.js';
import { Logger as LibLogger } from './lib/logger.js';
import { Jwt as LibJwt } from './lib/jwt.js';
import { Validator as LibValidator } from './lib/validator.js';
import { DbHelper } from './lib/dbHelper.js';
import { RedisHelper } from './lib/redisHelper.js';
import { RegexAliases } from './config/regexAliases.js';
import { paths } from './paths.js';
import type { KeyValue } from './types/common.js';
import type { JwtPayload, JwtSignOptions, JwtVerifyOptions } from './types/jwt';
import type { BeflyContext } from './types/befly.js';
import type { SqlClientOptions } from './types/database.js';
import type { Plugin } from './types/plugin.js';
import type { ParsedFieldRule } from './types/common.js';
import type { ValidationResult } from './types/validator';

// ========================================
// Logger 配置和导出
// ========================================

LibLogger.configure({
    logDir: Env.LOG_DIR || 'logs',
    maxFileSize: Env.LOG_MAX_SIZE || 50 * 1024 * 1024,
    enableDebug: Env.LOG_DEBUG === 1,
    toConsole: Env.LOG_TO_CONSOLE === 1
});

export const Logger = LibLogger;
export type { LoggerConfig } from './lib/logger.js';

// ========================================
// API 响应工具
// ========================================

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

// ========================================
// 环境判断工具
// ========================================

// ========================================
// 类型判断工具
// ========================================

/**
 * 类型判断
 */
export const isType = (value: any, type: string): boolean => {
    const actualType = Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
    const expectedType = String(type).toLowerCase();

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

// ========================================
// 对象操作工具
// ========================================

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
 * 字段清理
 */
export const fieldClear = <T extends Record<string, any> = any>(data: T, excludeValues: any[] = [null, undefined], keepValues: Record<string, any> = {}): Partial<T> => {
    if (!data || !isType(data, 'object')) {
        return {};
    }

    const result: any = {};

    for (const [key, value] of Object.entries(data)) {
        if (key in keepValues) {
            if (Object.is(keepValues[key], value)) {
                result[key] = value;
                continue;
            }
        }

        const shouldExclude = excludeValues.some((excludeVal) => Object.is(excludeVal, value));
        if (shouldExclude) {
            continue;
        }

        result[key] = value;
    }

    return result;
};

// ========================================
// 数据清洗工具
// ========================================

export interface DataCleanOptions {
    excludeKeys?: string[];
    includeKeys?: string[];
    removeValues?: any[];
    maxLen?: number;
    deep?: boolean;
}

/**
 * 数据清洗
 */
export const cleanData = <T = any>(data?: Record<string, any>, options: DataCleanOptions = {}): Partial<T> => {
    const { excludeKeys = [], includeKeys = [], removeValues = [null, undefined], maxLen = 0, deep = false } = options;

    if (!data || !isType(data, 'object')) {
        return data as Partial<T>;
    }

    const result: any = {};

    const shouldRemoveValue = (value: any): boolean => {
        return removeValues.some((removeVal) => Object.is(removeVal, value));
    };

    const processValue = (value: any): any => {
        if (deep && isType(value, 'object')) {
            return cleanData(value, options);
        }

        if (deep && isType(value, 'array')) {
            return value.map((item: any) => (isType(item, 'object') ? cleanData(item, options) : item));
        }

        if (maxLen > 0) {
            if (isType(value, 'string') && value.length > maxLen) {
                return value.substring(0, maxLen);
            }

            if (!isType(value, 'string')) {
                try {
                    const strValue = JSON.stringify(value);
                    if (strValue && strValue.length > maxLen) {
                        return strValue.substring(0, maxLen);
                    }
                } catch {}
            }
        }

        return value;
    };

    for (const [key, value] of Object.entries(data)) {
        if (shouldRemoveValue(value)) {
            continue;
        }

        if (includeKeys.length > 0) {
            if (includeKeys.includes(key)) {
                result[key] = processValue(value);
            }
            continue;
        }

        if (excludeKeys.includes(key)) {
            continue;
        }

        result[key] = processValue(value);
    }

    return result;
};

// ========================================
// 日期时间工具
// ========================================

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

// ========================================
// 字段转换工具
// ========================================

/**
 * 小驼峰转下划线
 */
export const toSnakeCase = (str: string): string => {
    if (!str || typeof str !== 'string') return str;

    let result = '';
    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (char >= 'A' && char <= 'Z') {
            if (i > 0) {
                result += '_';
            }
            result += char.toLowerCase();
        } else {
            result += char;
        }
    }

    return result;
};

/**
 * 下划线转小驼峰
 */
export const toCamelCase = (str: string): string => {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

/**
 * 对象字段名转下划线
 */
export const keysToSnake = <T = any>(obj: Record<string, any>): T => {
    if (!obj || !isType(obj, 'object')) return obj as T;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = toSnakeCase(key);
        result[snakeKey] = value;
    }
    return result;
};

/**
 * 对象字段名转小驼峰
 */
export const keysToCamel = <T = any>(obj: Record<string, any>): T => {
    if (!obj || !isType(obj, 'object')) return obj as T;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = toCamelCase(key);
        result[camelKey] = value;
    }
    return result;
};

/**
 * 数组对象字段名批量转小驼峰
 */
export const arrayKeysToCamel = <T = any>(arr: Record<string, any>[]): T[] => {
    if (!arr || !isType(arr, 'array')) return arr as T[];
    return arr.map((item) => keysToCamel<T>(item));
};

/**
 * Where 条件键名转下划线格式
 */
export const whereKeysToSnake = (where: any): any => {
    if (!where || typeof where !== 'object') return where;

    if (Array.isArray(where)) {
        return where.map((item) => whereKeysToSnake(item));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(where)) {
        if (key === '$or' || key === '$and') {
            result[key] = (value as any[]).map((item) => whereKeysToSnake(item));
            continue;
        }

        if (key.includes('$')) {
            const lastDollarIndex = key.lastIndexOf('$');
            const fieldName = key.substring(0, lastDollarIndex);
            const operator = key.substring(lastDollarIndex);
            const snakeKey = toSnakeCase(fieldName) + operator;
            result[snakeKey] = value;
            continue;
        }

        const snakeKey = toSnakeCase(key);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            result[snakeKey] = whereKeysToSnake(value);
        } else {
            result[snakeKey] = value;
        }
    }

    return result;
};

/**
 * 转换数据库 BIGINT 字段为数字类型
 */
export const convertBigIntFields = <T = any>(arr: Record<string, any>[], fields: string[] = ['id', 'pid', 'sort']): T[] => {
    if (!arr || !isType(arr, 'array')) return arr as T[];

    return arr.map((item) => {
        const converted = { ...item };

        for (const [key, value] of Object.entries(converted)) {
            if (value === undefined || value === null) {
                continue;
            }

            const shouldConvert = fields.includes(key) || key.endsWith('Id') || key.endsWith('_id') || key.endsWith('At') || key.endsWith('_at');

            if (shouldConvert && typeof value === 'string') {
                const num = Number(value);
                if (!isNaN(num)) {
                    converted[key] = num;
                }
            }
        }

        return converted as T;
    }) as T[];
};

// ========================================
// Bun 版本检查
// ========================================

const REQUIRED_BUN_VERSION = '1.3.0';

function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;

        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }

    return 0;
}

function getBunVersion(): string | null {
    try {
        if (typeof Bun !== 'undefined' && Bun.version) {
            return Bun.version;
        }

        const proc = Bun.spawnSync(['bun', '--version'], {
            stdout: 'pipe',
            stderr: 'pipe'
        });

        if (proc.exitCode === 0) {
            const version = proc.stdout.toString().trim();
            return version;
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * 检查 Bun 版本
 */
export function checkBunVersion(): void {
    const currentVersion = getBunVersion();

    if (!currentVersion) {
        Logger.error('未检测到 Bun 运行时');
        Logger.info('\nBefly CLI 需要 Bun v1.3.0 或更高版本');
        Logger.info('请访问 https://bun.sh 安装 Bun\n');
        Logger.info('安装命令:');
        Logger.info('  Windows (PowerShell): powershell -c "irm bun.sh/install.ps1 | iex"');
        Logger.info('  macOS/Linux: curl -fsSL https://bun.sh/install | bash\n');
        process.exit(1);
    }

    const comparison = compareVersions(currentVersion, REQUIRED_BUN_VERSION);

    if (comparison < 0) {
        Logger.error(`Bun 版本过低: ${currentVersion}`);
        Logger.info(`\n需要 Bun v${REQUIRED_BUN_VERSION} 或更高版本`);
        Logger.info('请升级 Bun:\n');
        Logger.info('  bun upgrade\n');
        process.exit(1);
    }
}

// ========================================
// JWT 工具类
// ========================================

/**
 * JWT 工具类（带 Env 集成）
 */
export class Jwt extends LibJwt {
    static create(payload: JwtPayload): string {
        const expiresIn = Env.JWT_EXPIRES_IN || '7d';
        const algorithm = (Env.JWT_ALGORITHM || 'HS256') as any;
        return super.sign(payload, Env.JWT_SECRET, {
            expiresIn,
            algorithm
        });
    }

    static check(token: string): JwtPayload {
        return this.verify(token, Env.JWT_SECRET);
    }

    static parse(token: string): JwtPayload {
        return this.decode(token);
    }

    static sign(payload: JwtPayload, secretOrOptions?: string | JwtSignOptions, expiresIn?: string | number): string {
        if (typeof secretOrOptions === 'string') {
            return super.sign(payload, secretOrOptions, { expiresIn });
        }

        const options = secretOrOptions || {};
        const secret = options.secret || Env.JWT_SECRET;
        const { secret: _, ...restOptions } = options;

        return super.sign(payload, secret, restOptions);
    }

    static verify(token: string, secretOrOptions?: string | JwtVerifyOptions): JwtPayload {
        if (typeof secretOrOptions === 'string') {
            return super.verify(token, secretOrOptions);
        }

        const options = secretOrOptions || {};
        const secret = options.secret || Env.JWT_SECRET;
        const { secret: _, ...restOptions } = options;

        return super.verify(token, secret, restOptions);
    }

    static signUserToken(userInfo: JwtPayload, options: Omit<JwtSignOptions, 'secret'> = {}): string {
        return super.signUserToken(userInfo, Env.JWT_SECRET, options);
    }

    static signAPIToken(payload: JwtPayload, options: Omit<JwtSignOptions, 'secret'> = {}): string {
        return super.signAPIToken(payload, Env.JWT_SECRET, options);
    }

    static signRefreshToken(payload: JwtPayload, options: Omit<JwtSignOptions, 'secret'> = {}): string {
        return super.signRefreshToken(payload, Env.JWT_SECRET, options);
    }

    static signTempToken(payload: JwtPayload, options: Omit<JwtSignOptions, 'secret'> = {}): string {
        return super.signTempToken(payload, Env.JWT_SECRET, options);
    }

    static verifyUserToken(token: string, options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifyUserToken(token, Env.JWT_SECRET, options);
    }

    static verifyAPIToken(token: string, options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifyAPIToken(token, Env.JWT_SECRET, options);
    }

    static verifyRefreshToken(token: string, options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifyRefreshToken(token, Env.JWT_SECRET, options);
    }

    static verifyTempToken(token: string, options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifyTempToken(token, Env.JWT_SECRET, options);
    }

    static verifyWithPermissions(token: string, requiredPermissions: string | string[], options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifyWithPermissions(token, Env.JWT_SECRET, requiredPermissions, options);
    }

    static verifyWithRoles(token: string, requiredRoles: string | string[], options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifyWithRoles(token, Env.JWT_SECRET, requiredRoles, options);
    }

    static verifySoft(token: string, options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifySoft(token, Env.JWT_SECRET, options);
    }
}

// ========================================
// Validator 工具类
// ========================================

/**
 * 解析字段规则字符串
 */
export const parseRule = (rule: string): ParsedFieldRule => {
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

    const [fieldName = '', fieldType = 'string', fieldMinStr = 'null', fieldMaxStr = 'null', fieldDefaultStr = 'null', fieldIndexStr = '0', fieldRegx = 'null'] = parts;

    const fieldIndex = Number(fieldIndexStr) as 0 | 1;
    const fieldMin = fieldMinStr !== 'null' ? Number(fieldMinStr) : null;
    const fieldMax = fieldMaxStr !== 'null' ? Number(fieldMaxStr) : null;

    let fieldDefault: any = fieldDefaultStr;
    if (fieldType === 'number' && fieldDefaultStr !== 'null') {
        fieldDefault = Number(fieldDefaultStr);
    }

    return {
        name: fieldName,
        type: fieldType as 'string' | 'number' | 'text' | 'array',
        min: fieldMin,
        max: fieldMax,
        default: fieldDefault,
        index: fieldIndex,
        regex: fieldRegx !== 'null' ? fieldRegx : null
    };
};

/**
 * 验证器类
 */
export class Validator extends LibValidator {
    constructor() {
        super({
            regexAliases: RegexAliases as any,
            parseRule
        });
    }
}

/**
 * 验证器实例
 */
export const validator = new Validator();

/**
 * 验证函数
 */
export const validate = (dataOrValue: any, rulesOrRule: any, required: string[] = []): any => {
    const config = { regexAliases: RegexAliases as any, parseRule };
    if (typeof rulesOrRule === 'string') {
        return LibValidator.validate(dataOrValue, rulesOrRule, config);
    }
    return LibValidator.validate(dataOrValue, rulesOrRule, required, config);
};

export type { ValidatorConfig, DEFAULT_REGEX_ALIASES } from './lib/validator.js';

// ========================================
// Addon 管理工具
// ========================================

/**
 * 扫描所有可用的 addon
 */
export const scanAddons = (): string[] => {
    const beflyDir = join(paths.projectDir, 'node_modules', '@befly');

    if (!fs.existsSync(beflyDir)) {
        return [];
    }

    try {
        return fs
            .readdirSync(beflyDir)
            .filter((name) => {
                if (!name.startsWith('addon-')) return false;
                const fullPath = join(beflyDir, name);
                try {
                    const stat = fs.statSync(fullPath);
                    return stat.isDirectory();
                } catch {
                    return false;
                }
            })
            .sort();
    } catch {
        return [];
    }
};

/**
 * 获取 addon 的指定子目录路径
 */
export const getAddonDir = (addonName: string, subDir: string): string => {
    return join(paths.projectDir, 'node_modules', '@befly', addonName, subDir);
};

/**
 * 检查 addon 子目录是否存在
 */
export const addonDirExists = (addonName: string, subDir: string): boolean => {
    const dir = getAddonDir(addonName, subDir);
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
};

// ========================================
// 数据库管理工具
// ========================================

interface DatabaseConnections {
    redis: RedisClient | null;
    sql: any;
    helper: DbHelper | null;
}

const connections: DatabaseConnections = {
    redis: null,
    sql: null,
    helper: null
};

/**
 * 创建 Redis 客户端
 */
export async function createRedisClient(): Promise<RedisClient> {
    try {
        // 构建 Redis URL
        const { REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD, REDIS_DB } = Env;

        let auth = '';
        if (REDIS_USERNAME && REDIS_PASSWORD) {
            auth = `${REDIS_USERNAME}:${REDIS_PASSWORD}@`;
        } else if (REDIS_PASSWORD) {
            auth = `:${REDIS_PASSWORD}@`;
        }

        const url = `redis://${auth}${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`;

        const redis = new RedisClient(url, {
            connectionTimeout: 10000,
            idleTimeout: 0,
            autoReconnect: true,
            maxRetries: 0,
            enableOfflineQueue: true,
            enableAutoPipelining: true
        });

        await redis.ping();
        Logger.info('Redis 连接成功');

        return redis;
    } catch (error: any) {
        Logger.error('Redis 连接失败', error);
        throw new Error(`Redis 连接失败: ${error.message}`);
    }
}

/**
 * 创建 SQL 客户端
 */
export async function createSqlClient(options: SqlClientOptions = {}): Promise<any> {
    // 构建数据库连接字符串
    const type = Env.DB_TYPE || '';
    const host = Env.DB_HOST || '';
    const port = Env.DB_PORT;
    const user = encodeURIComponent(Env.DB_USER || '');
    const password = encodeURIComponent(Env.DB_PASSWORD || '');
    const database = encodeURIComponent(Env.DB_DATABASE || '');

    let finalUrl: string;
    if (type === 'sqlite') {
        finalUrl = database;
    } else {
        if (!host || !database) {
            throw new Error('数据库配置不完整，请检查环境变量');
        }
        finalUrl = `${type}://${user}:${password}@${host}:${port}/${database}`;
    }

    let sql: any = null;

    if (Env.DB_TYPE === 'sqlite') {
        sql = new SQL(finalUrl);
    } else {
        sql = new SQL({
            url: finalUrl,
            max: options.max ?? 1,
            bigint: false,
            ...options
        });
    }

    try {
        const timeout = options.connectionTimeout ?? 5000;

        const healthCheckPromise = (async () => {
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
            return version;
        })();

        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`数据库连接超时 (${timeout}ms)`));
            }, timeout);
        });

        const version = await Promise.race([healthCheckPromise, timeoutPromise]);

        Logger.info(`数据库连接成功，version: ${version}`);
        return sql;
    } catch (error: any) {
        Logger.error('数据库连接测试失败', error);

        try {
            await sql.close();
        } catch (cleanupError) {}

        throw error;
    }
}

/**
 * 初始化数据库连接
 */
export async function initDatabase(options: SqlClientOptions = {}): Promise<DatabaseConnections> {
    try {
        Logger.info('正在初始化 Redis 连接...');
        connections.redis = await createRedisClient();

        Logger.info('正在初始化 SQL 连接...');
        connections.sql = await createSqlClient(options);

        const befly: BeflyContext = {
            redis: RedisHelper,
            db: null as any,
            tool: null as any,
            logger: null as any
        };
        connections.helper = new DbHelper(befly, connections.sql);

        Logger.info('数据库连接初始化完成（Redis + SQL + DbHelper）');

        return {
            redis: connections.redis,
            sql: connections.sql,
            helper: connections.helper
        };
    } catch (error: any) {
        Logger.error('数据库初始化失败', error);
        await closeDatabase();
        throw error;
    }
}

/**
 * 关闭所有数据库连接
 */
export async function closeDatabase(): Promise<void> {
    try {
        if (connections.sql) {
            try {
                await connections.sql.close();
                Logger.info('SQL 连接已关闭');
            } catch (error: any) {
                Logger.warn('关闭 SQL 连接时出错:', error.message);
            }
            connections.sql = null;
        }

        if (connections.redis) {
            try {
                connections.redis.close();
                Logger.info('Redis 连接已关闭');
            } catch (error: any) {
                Logger.warn('关闭 Redis 连接时出错:', error);
            }
            connections.redis = null;
        }

        connections.helper = null;
    } catch (error: any) {
        Logger.error('关闭数据库连接时出错', error);
    }
}

/**
 * 获取 Redis 客户端
 */
export function getRedis(): RedisClient | null {
    return connections.redis;
}

/**
 * 仅初始化 SQL 连接
 */
export async function initSqlOnly(options: SqlClientOptions = {}): Promise<{ sql: any; helper: DbHelper }> {
    try {
        Logger.info('正在初始化 SQL 连接（不含 Redis）...');
        connections.sql = await createSqlClient(options);

        const befly: BeflyContext = {
            redis: null as any,
            db: null as any,
            tool: null as any,
            logger: null as any
        };
        connections.helper = new DbHelper(befly, connections.sql);

        Logger.info('SQL 连接初始化完成');

        return {
            sql: connections.sql,
            helper: connections.helper
        };
    } catch (error: any) {
        Logger.error('SQL 初始化失败', error);
        throw error;
    }
}

/**
 * 仅初始化 Redis 连接
 */
export async function initRedisOnly(): Promise<RedisClient> {
    try {
        Logger.info('正在初始化 Redis 连接（不含 SQL）...');
        connections.redis = await createRedisClient();
        Logger.info('Redis 连接初始化完成');
        return connections.redis;
    } catch (error: any) {
        Logger.error('Redis 初始化失败', error);
        throw error;
    }
}

// ========================================
// 插件管理工具
// ========================================

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
        if (!plugin) return;

        visiting.add(name);
        (plugin.dependencies || []).forEach(visit);
        visiting.delete(name);
        visited.add(name);
        result.push(plugin);
    };

    plugins.forEach((p) => visit(p.name));
    return isPass ? result : false;
};

// ========================================
// 请求上下文
// ========================================

/**
 * 请求上下文接口
 */
export interface RequestContext {
    /** 请求体参数 */
    body: Record<string, any>;
    /** 用户信息 */
    /** 用户信息 */
    user: Record<string, any>;
    /** 原始请求对象 */
    request: Request;
    /** 请求开始时间（毫秒） */
    startTime: number;
}
