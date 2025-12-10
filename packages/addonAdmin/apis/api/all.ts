export default {
    name: '获取所有接口',
    handler: async (befly, ctx) => {
        try {
            // 从缓存获取所有接口
            let allApis = await befly.cache.getApis();

            // 如果缓存不存在，从数据库查询
            if (allApis.length === 0) {
                const result = await befly.db.getAll({
                    table: 'addon_admin_api',
                    fields: ['id', 'name', 'path', 'method', 'description', 'addonName', 'addonTitle'],
                    orderBy: ['addonName#ASC', 'path#ASC']
                });
                allApis = result.lists;
            }

            return befly.tool.Yes('操作成功', { lists: allApis });
        } catch (error: any) {
            befly.logger.error({ err: error }, '获取接口列表失败');
            return befly.tool.No('获取接口列表失败');
        }
    }
};
