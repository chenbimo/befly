/**
 * Redis 插件 - TypeScript 版本
 * 初始化 Redis 连接和助手工具
 */

import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { RedisHelper } from '../lib/redisHelper.js';
import { initRedisOnly } from '../utils/database.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * Redis 插件
 */
const redisPlugin: Plugin = {
    name: '_redis',
    after: ['_logger'],

    async onInit(befly: BeflyContext): Promise<typeof RedisHelper | Record<string, never>> {
        try {
            if (Env.REDIS_ENABLE === 1) {
                // 初始化 Redis 客户端（统一使用 database.ts 的连接管理）
                await initRedisOnly();

                Logger.info('Redis 插件初始化成功', {
                    host: Env.REDIS_HOST,
                    port: Env.REDIS_PORT,
                    db: Env.REDIS_DB
                });

                // 返回工具对象，向下游以相同 API 暴露
                return RedisHelper;
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
