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
    async handler(befly: BeflyContext): Promise<RedisHelper | Record<string, never>> {
        const env = befly.config?.nodeEnv;
        const redisPrefix = befly.config?.redis?.prefix;
        try {
            // 启动期已建立 Redis 连接；这里仅校验连接存在
            Connect.getRedis();

            // 返回 RedisHelper 实例
            return new RedisHelper(redisPrefix);
        } catch (error: unknown) {
            Logger.error({ env: env, err: error, msg: "Redis 初始化失败" });
            throw error;
        }
    }
};

export default redisPlugin;
