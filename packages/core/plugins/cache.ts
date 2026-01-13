/**
 * 缓存插件 - TypeScript 版本
 * 负责在服务器启动时缓存接口、菜单和角色权限到 Redis
 */

import type { BeflyContext } from "../types/befly";
import type { Plugin } from "../types/plugin";

import { CacheHelper } from "../lib/cacheHelper";

/**
 * 缓存插件
 */
const cachePlugin: Plugin = {
    name: "cache",
    enable: true,
    deps: ["logger", "redis", "db"],
    async handler(befly: BeflyContext): Promise<CacheHelper> {
        if (!befly.db) {
            throw new Error("缓存初始化失败：ctx.db 未初始化");
        }

        if (!befly.redis) {
            throw new Error("缓存初始化失败：ctx.redis 未初始化");
        }

        return new CacheHelper({ db: befly.db, redis: befly.redis });
    }
};

export default cachePlugin;
