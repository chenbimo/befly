/**
 * Befly 工具函数集 - TypeScript 版本
 *
 * 本文件作为统一导出入口，从各个专用工具模块重新导出功能
 * 保持向后兼容性，支持从 utils/index.js 导入所有工具函数
 */

// ========== 通用工具函数（util.ts 包含所有实现）==========
export * from './util.js';

// ========== 框架工具 ==========
export { scanAddons, getAddonDir, addonDirExists } from './addon.js';
export { sortPlugins } from './plugin.js';
export { parseRule } from './table.js';

// ========== 数据库工具 ==========
export { buildDatabaseUrl, createSqlClient, buildRedisUrl, createRedisClient, initDatabase, closeDatabase, initSqlOnly, initRedisOnly, getRedis, getSql, getDbHelper, isDatabaseInitialized } from './database.js';

// 导出其他大型模块
export { Logger } from './logger.js';
export { Validator } from './validate.js';
export { DbHelper } from '../lib/dbHelper.js';
export { RedisHelper } from '../lib/redisHelper.js';
export { Jwt } from './jwt.js';

// lib/ 模块
export { SqlBuilder } from '../lib/sqlBuilder.js';
export { Cipher } from '../lib/cipher.js';
export { Xml } from '../lib/xml.js';

// 类型导出
export type { QueryOptions, InsertOptions, UpdateOptions, DeleteOptions, ListResult, TransactionCallback } from '../lib/dbHelper.js';
export type { JwtPayload } from './jwt.js';
export type { EncodingType, HashAlgorithm } from '../lib/cipher.js';
export type { XmlParseOptions } from '../lib/xml.js';
