/**
 * SyncRolePermissions 命令 - 重建角色接口权限缓存到 Redis
 *
 * 说明：
 * - 依赖 addon-admin 的 addon_admin_role / addon_admin_api 表
 * - 使用 CacheHelper 的 rebuildRoleApiPermissions 进行全量重建
 * - 成功后写入 roleApisReady 标记，permission hook 才会放行
 */

import { Connect } from '../lib/connect.js';
import { CacheHelper } from '../lib/cacheHelper.js';
import { DbHelper } from '../lib/dbHelper.js';
import { Logger } from '../lib/logger.js';
import { RedisHelper } from '../lib/redisHelper.js';

export async function syncRolePermissionsCommand(): Promise<void> {
    try {
        // 连接数据库（SQL + Redis）
        await Connect.connect();

        const helper = new DbHelper({ redis: new RedisHelper() } as any, Connect.getSql());
        const tempBefly = { db: helper, redis: new RedisHelper() } as any;

        const cacheHelper = new CacheHelper(tempBefly);
        await cacheHelper.rebuildRoleApiPermissions();
    } catch (error: any) {
        Logger.error({ err: error }, '同步角色权限缓存失败');
        throw error;
    } finally {
        await Connect.disconnect();
    }
}
