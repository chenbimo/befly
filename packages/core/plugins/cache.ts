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
export default {
    name: "cache",
    deps: ["logger", "redis", "db"],
    async handler(befly: BeflyContext): Promise<CacheHelper> {
        if (!(befly as any).db) {
            throw new Error("缓存初始化失败：ctx.db 未初始化（Db 插件未加载或注入失败）");
        }

        if (!(befly as any).redis) {
            throw new Error("缓存初始化失败：ctx.redis 未初始化（Redis 插件未加载或注入失败）");
        }

        return new CacheHelper({ db: befly.db, redis: befly.redis });
    }
} satisfies Plugin;
