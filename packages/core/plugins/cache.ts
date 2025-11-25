/**
 * 缓存插件 - TypeScript 版本
 * 负责在服务器启动时缓存接口、菜单和角色权限到 Redis
 */

import { CacheHelper } from '../lib/cacheHelper.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * 缓存插件
 */
const cachePlugin: Plugin = {
    after: [],
    async handler(befly: BeflyContext): Promise<CacheHelper> {
        return new CacheHelper(befly);
    }
};

export default cachePlugin;
