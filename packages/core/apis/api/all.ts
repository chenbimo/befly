/**
 * 获取所有接口列表
 * 说明：用于角色权限配置，返回所有接口信息
 */

import { Yes, No } from '../../util.js';

export default {
    name: '获取所有接口',
    handler: async (befly, ctx) => {
        try {
            // 从 Redis 缓存读取所有接口
            let allApis = await befly.redis.getObject<any[]>('apis:all');

            // 如果缓存不存在，从数据库查询
            if (!allApis || allApis.length === 0) {
                befly.logger.info('接口缓存未命中，从数据库查询');
                allApis = await befly.db.getAll({
                    table: 'addon_admin_api',
                    fields: ['id', 'name', 'path', 'method', 'description', 'addonName', 'addonTitle'],
                    orderBy: ['addonName#ASC', 'path#ASC']
                });

                // 回写缓存
                if (allApis.length > 0) {
                    await befly.redis.setObject('apis:all', allApis);
                }
                return Yes('操作成功', { lists: allApis, from: '来自数据库' });
            } else {
                return Yes('操作成功', { lists: allApis, from: '来自缓存' });
            }
        } catch (error: any) {
            befly.logger.error('获取接口列表失败:', error);
            return No('获取接口列表失败');
        }
    }
};
