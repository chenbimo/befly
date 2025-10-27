/**
 * 刷新所有缓存到 Redis
 * 说明：手动触发缓存刷新，无需重启服务器
 */

import type { ApiRoute } from 'befly/types/api';
import { Yes, No } from 'befly/utils';
import { CacheManager } from 'befly/lifecycle/cacheManager';
import { Field } from 'befly/config/fields';

export default {
    name: '刷新缓存',
    method: 'POST',
    auth: true,
    fields: {},
    required: [],
    handler: async (befly, ctx) => {
        try {
            // 检查权限（仅 dev 角色可执行）
            if (ctx.user?.role !== 'dev') {
                return No('无权限执行此操作');
            }

            // 执行缓存刷新
            await CacheManager.cacheAll(befly.apiRoutes, befly);

            return Yes('缓存刷新成功', {
                message: '已重新缓存接口、菜单和角色权限'
            });
        } catch (error: any) {
            return No('缓存刷新失败', {
                error: error.message
            });
        }
    }
} as ApiRoute;
