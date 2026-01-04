/**
 * Redis 插件
 * 初始化 Redis 连接和助手工具
 */

import type { BeflyContext } from "../types/befly.ts";
import type { Plugin } from "../types/plugin.ts";

import { Connect } from "../lib/connect.ts";
import { Logger } from "../lib/logger.ts";
import { RedisHelper } from "../lib/redisHelper.ts";

/**
 * Redis 插件
 */
export default {
    deps: ["logger"],
    async handler(context: BeflyContext): Promise<RedisHelper | Record<string, never>> {
        const redisConfig = context.config && context.config.redis ? context.config.redis : {};
        try {
            // 启动期已建立 Redis 连接；这里仅校验连接存在
            Connect.getRedis();

            // 返回 RedisHelper 实例
            return new RedisHelper(redisConfig.prefix);
        } catch (error: any) {
            Logger.error({ err: error }, "Redis 初始化失败");
            throw error;
        }
    }
} satisfies Plugin;
