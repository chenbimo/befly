export default {
    name: '获取字典列表',
    fields: {
        page: '@page',
        limit: '@limit',
        keyword: '@keyword',
        state: '@state'
    },
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: 'addon_admin_dict',
            fields: ['id', 'name', 'code', 'value', 'sort', 'pid', 'description', 'state', 'created_at', 'updated_at'],
            page: ctx.body.page,
            limit: ctx.body.limit,
            orderBy: ['sort#ASC', 'id#ASC']
        });

        return befly.tool.Yes('操作成功', result);
    }
};
