/**
 * Redis 插件 - TypeScript 版本
 * 初始化 Redis 连接和助手工具
 */

import { Logger } from '../lib/logger.js';
import { RedisHelper } from '../lib/redisHelper.js';
import { Database } from '../lib/database.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * Redis 插件
 */
const redisPlugin: Plugin = {
    after: ['logger'],
    async onInit(this: Plugin, befly: BeflyContext): Promise<RedisHelper | Record<string, never>> {
        const config = this.config || {};
        try {
            // 默认启用，除非显式禁用 (这里假设只要配置了 redis 插件就启用，或者检查 enable 字段)
            // 为了兼容性，如果 config 为空，可能意味着使用默认值连接本地 redis

            // 初始化 Redis 客户端（统一使用 database.ts 的连接管理）
            await Database.connectRedis(config);

            // 返回 RedisHelper 实例
            return new RedisHelper(config.prefix);
        } catch (error: any) {
            Logger.error('Redis 初始化失败', error);

            // 插件内禁止直接退出进程，抛出异常交由主流程统一处理
            throw error;
        }
    }
};

export default redisPlugin;
