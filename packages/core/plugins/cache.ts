/**
 * 缓存插件 - TypeScript 版本
 * 负责在服务器启动时缓存接口、菜单和角色权限到 Redis
 */

import type { BeflyContext } from "../types/befly.js";
import type { Plugin } from "../types/plugin.js";

import { CacheHelper } from "../lib/cacheHelper.js";

/**
 * 缓存插件
 */
const cachePlugin: Plugin = {
    after: [],
    async handler(befly: BeflyContext): Promise<CacheHelper> {
        return new CacheHelper({ db: befly.db, redis: befly.redis });
    }
};

export default cachePlugin;
