/**
 * Redis 插件 - TypeScript 版本
 * 初始化 Redis 连接和助手工具
 */

import { redis } from 'bun';
import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { RedisHelper, getRedisClient } from '../utils/redisHelper.js';
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
                const client = getRedisClient();
                const pingResult = await client.ping();

                if (pingResult !== 'PONG') {
                    throw new Error('Redis 连接失败：ping 响应异常');
                }

                Logger.info('Redis 插件初始化成功');
                // 返回工具对象，向下游以相同 API 暴露
                return RedisHelper;
            } else {
                Logger.warn('Redis 未启用（REDIS_ENABLE≠1），跳过初始化');
                return {};
            }
        } catch (error: any) {
            Logger.error({
                msg: 'Redis 初始化失败',
                message: error.message,
                stack: error.stack
            });

            // 插件内禁止直接退出进程，抛出异常交由主流程统一处理
            throw error;
        }
    }
};

export default redisPlugin;
