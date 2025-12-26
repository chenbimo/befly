/**
 * Redis 插件
 * 初始化 Redis 连接和助手工具
 */

import type { BeflyContext } from "../types/befly.js";
import type { Plugin } from "../types/plugin.js";

import { Connect } from "../lib/connect.js";
import { Logger } from "../lib/logger.js";
import { RedisHelper } from "../lib/redisHelper.js";

/**
 * Redis 插件
 */
export default {
    deps: ["logger"],
    async handler(context: BeflyContext): Promise<RedisHelper | Record<string, never>> {
        const redisConfig = context.config && context.config.redis ? context.config.redis : {};
        try {
            // 初始化 Redis 客户端
            await Connect.connectRedis(redisConfig);

            // 返回 RedisHelper 实例
            return new RedisHelper(redisConfig.prefix);
        } catch (error: any) {
            Logger.error({ err: error }, "Redis 初始化失败");
            throw error;
        }
    }
} satisfies Plugin;
