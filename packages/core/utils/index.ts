/**
 * Befly 工具函数集 - TypeScript 版本
 *
 * 本文件作为统一导出入口，从各个专用工具模块重新导出功能
 * 保持向后兼容性，支持从 utils/index.js 导入所有工具函数
 */

// ========== 通用辅助工具（helpers.ts）==========
export { Yes, No, isDebug, isType, isEmptyObject, isEmptyArray, pickFields, formatDate, calcPerfTime, cleanData, toSnakeCase, toCamelCase, keysToSnake, keysToCamel } from './helper.js';
export type { DataCleanOptions } from './helper.js';

// ========== 框架工具 ==========
export { Api, scanAddons, getAddonDir, addonDirExists, sortPlugins, parseRule } from './helper.js';

// ========== 数据库工具 ==========
export { buildDatabaseUrl, createSqlClient, buildRedisUrl, createRedisClient, initDatabase, closeDatabase, initSqlOnly, initRedisOnly, getRedis, getSql, getSqlHelper, isDatabaseInitialized } from './database.js';

// ========== 错误处理 ==========
export { ErrorHandler } from './errorHandler.js';

// 导出其他大型模块
export { Colors } from './colors.js';
export { Logger } from './logger.js';
export { Validator } from './validate.js';
export { SqlBuilder } from './sqlBuilder.js';
export { DbHelper } from './dbHelper.js';
export { RedisHelper } from './redisHelper.js';
export { Jwt } from './jwt.js';
export { Crypto2 } from './crypto.js';
export { Xml } from './xml.js';

// 类型导出
export type { QueryOptions, InsertOptions, UpdateOptions, DeleteOptions, ListResult, TransactionCallback } from './dbHelper.js';
export type { JwtPayload } from './jwt.js';
export type { EncodingType, HashAlgorithm } from './crypto.js';
export type { XmlParseOptions } from './xml.js';
