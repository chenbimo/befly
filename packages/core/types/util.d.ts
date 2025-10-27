/**
 * util.ts 相关类型定义
 */

import type { RedisClient } from 'bun';
import type { DbHelper } from '../lib/dbHelper.js';

/**
 * 数据清洗选项
 */
export interface DataCleanOptions {
    /** 排除的字段名 */
    excludeKeys?: string[];
    /** 包含的字段名（优先级高于 excludeKeys） */
    includeKeys?: string[];
    /** 要移除的值 */
    removeValues?: any[];
    /** 字符串最大长度（超出截断） */
    maxLen?: number;
    /** 是否深度处理嵌套对象 */
    deep?: boolean;
}

/**
 * 数据库连接集合（内部使用）
 */
export interface DatabaseConnections {
    redis: RedisClient | null;
    sql: any;
    helper: DbHelper | null;
}

/**
 * 请求上下文接口
 */
export interface RequestContext {
    /** 请求体参数 */
    body: Record<string, any>;
    /** 用户信息 */
    user: Record<string, any>;
    /** 原始请求对象 */
    request: Request;
    /** 请求开始时间（毫秒） */
    startTime: number;
}
