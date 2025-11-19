/**
 * Redis 插件 - TypeScript 版本
 * 初始化 Redis 连接和助手工具
 */

import { Env } from '../env.js';
import { Logger } from '../lib/logger.js';
import { RedisHelper } from '../lib/redisHelper.js';
import { Database } from '../lib/database.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * Redis 插件
 */
const redisPlugin: Plugin = {
    name: '_redis',
    after: ['_logger'],

    async onInit(befly: BeflyContext): Promise<RedisHelper | Record<string, never>> {
        try {
            if (Env.DATABASE_ENABLE === 1) {
                // 初始化 Redis 客户端（统一使用 database.ts 的连接管理）
                await Database.connectRedis();

                // 返回 RedisHelper 实例
                return new RedisHelper();
            } else {
                Logger.warn('Redis 未启用，跳过初始化');
                return {};
            }
        } catch (error: any) {
            Logger.error('Redis 初始化失败', error);

            // 插件内禁止直接退出进程，抛出异常交由主流程统一处理
            throw error;
        }
    }
};

export default redisPlugin;
