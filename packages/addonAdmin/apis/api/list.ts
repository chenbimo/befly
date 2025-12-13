export default {
    name: '获取接口列表',
    fields: {
        page: '@page',
        limit: '@limit',
        keyword: '@keyword',
        state: '@state'
    },
    handler: async (befly, ctx) => {
        try {
            // 构建查询条件
            const where: Record<string, any> = {};
            if (ctx.body.keyword) {
                where.$or = [{ name: { $like: `%${ctx.body.keyword}%` } }, { path: { $like: `%${ctx.body.keyword}%` } }];
            }

            const result = await befly.db.getList({
                table: 'addon_admin_api',
                fields: ['*'],
                where: where,
                orderBy: ['id#ASC'],
                page: ctx.body.page,
                limit: ctx.body.limit
            });

            return befly.tool.Yes('操作成功', result);
        } catch (error: any) {
            befly.logger.error({ err: error }, '获取接口列表失败');
            return befly.tool.No('获取接口列表失败');
        }
    }
};
