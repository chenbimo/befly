import dictTypeTable from '../../tables/dictType.json';

export default {
    name: '获取字典类型列表',
    fields: {
        page: '@page',
        limit: '@limit',
        keyword: '@keyword',
        state: '@state'
    },
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: 'addon_admin_dict_type',
            fields: ['*'],
            where: {
                name$like: ctx.body.keyword ? `%${ctx.body.keyword}%` : undefined
            },
            orderBy: ['sort#ASC', 'id#ASC'],
            page: ctx.body.page,
            limit: ctx.body.limit
        });

        return befly.tool.Yes('操作成功', result);
    }
};
