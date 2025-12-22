/**
 * Redis 插件
 * 初始化 Redis 连接和助手工具
 */

import type { Plugin } from "../types/plugin.js";

import { beflyConfig } from "../befly.config.js";
import { Connect } from "../lib/connect.js";
import { Logger } from "../lib/logger.js";
import { RedisHelper } from "../lib/redisHelper.js";

/**
 * Redis 插件
 */
const redisPlugin: Plugin = {
    name: "",
    deps: ["logger"],
    async handler(): Promise<RedisHelper | Record<string, never>> {
        const redisConfig = beflyConfig.redis || {};
        try {
            // 初始化 Redis 客户端
            await Connect.connectRedis();

            // 返回 RedisHelper 实例
            return new RedisHelper(redisConfig.prefix);
        } catch (error: any) {
            Logger.error({ err: error }, "Redis 初始化失败");
            throw error;
        }
    }
};

export default redisPlugin;
