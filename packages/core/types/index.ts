/**
 * 类型定义导出
 *
 * 注意：通用类型已迁移到 befly-shared/types
 * - addon, crypto, jwt, logger, tool 等类型请从 befly-shared/types 导入
 */

export * from './api.js';
export * from './befly.js';
export * from './cache.js';
export * from './context.js';
export * from './hook.js';
export * from './plugin.js';
export * from './redis.js';
export * from './table.js';

// common.js 包含基础类型
export * from './common.js';

// database.js 中除了与 common.js 重复的类型外，其他都导出
export type { TypedQueryOptions, TypedInsertOptions, TypedUpdateOptions, TypedDeleteOptions, QueryOptions, InsertOptions, UpdateOptions, DeleteOptions, ListResult, TransactionCallback, DbType, ColumnInfo, IndexInfo } from './database.js';

// sync.js 中不重复的类型
export type { SyncDbOptions, SyncOptions, SyncMenuOptions, MenuConfig, SyncDevOptions, SyncApiOptions, ApiInfo, SyncMenuStats, SyncApiStats, GlobalStats, PhaseStats, SyncReport, SyncReportMeta, DatabaseReport, ApiReport, MenuReport } from './sync.js';
