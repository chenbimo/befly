import { Yes, No } from 'befly';

export default {
    name: '获取所有接口',
    handler: async (befly, ctx) => {
        try {
            // 从缓存获取所有接口
            let allApis = await befly.cache.getApis();

            // 如果缓存不存在，从数据库查询
            if (allApis.length === 0) {
                allApis = await befly.db.getAll({
                    table: 'addon_admin_api',
                    fields: ['id', 'name', 'path', 'method', 'description', 'addonName', 'addonTitle'],
                    orderBy: ['addonName#ASC', 'path#ASC']
                });
            }

            return Yes('操作成功', { lists: allApis });
        } catch (error: any) {
            befly.logger.error('获取接口列表失败:', error);
            return No('获取接口列表失败');
        }
    }
};
