/**
 * Redis 插件
 * 初始化 Redis 连接和助手工具
 */

import type { BeflyContext } from "../types/befly";
import type { Plugin } from "../types/plugin";

import { Connect } from "../lib/connect";
import { Logger } from "../lib/logger";
import { RedisHelper } from "../lib/redisHelper";

/**
 * Redis 插件
 */
const redisPlugin: Plugin = {
    name: "redis",
    enable: true,
    deps: ["logger"],
    async handler(context: BeflyContext): Promise<RedisHelper | Record<string, never>> {
        const redisConfig = context.config && context.config.redis ? context.config.redis : {};
        try {
            // 启动期已建立 Redis 连接；这里仅校验连接存在
            Connect.getRedis();

            // 返回 RedisHelper 实例
            return new RedisHelper(redisConfig.prefix);
        } catch (error: any) {
            Logger.error({ err: error, msg: "Redis 初始化失败" });
            throw error;
        }
    }
};

export default redisPlugin;
