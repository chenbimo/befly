/**
 * Redis 插件
 * 初始化 Redis 连接和助手工具
 */

import { Logger } from '../lib/logger.js';
import { Connect } from '../lib/connect.js';
import { RedisHelper } from '../lib/redisHelper.js';
import { config } from '../config.js';

import type { Plugin } from '../types/plugin.js';

/**
 * Redis 插件
 */
const redisPlugin: Plugin = {
    after: ['logger'],
    async handler(): Promise<RedisHelper | Record<string, never>> {
        const redisConfig = config.redis || {};
        try {
            // 初始化 Redis 客户端
            await Connect.connectRedis(redisConfig);

            // 返回 RedisHelper 实例
            return new RedisHelper(redisConfig.prefix);
        } catch (error: any) {
            Logger.error({ err: error }, 'Redis 初始化失败');
            throw error;
        }
    }
};

export default redisPlugin;
