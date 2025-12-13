export default {
    name: '获取字典列表',
    fields: {
        '@page': true,
        '@limit': true,
        typeCode: { type: 'string', label: '类型代码' },
        keyword: '@keyword'
    },
    handler: async (befly, ctx) => {
        const where: any = {};
        if (ctx.body.typeCode) where['d.typeCode'] = ctx.body.typeCode;
        if (ctx.body.keyword) {
            where.$or = [{ 'd.key$like': `%${ctx.body.keyword}%` }, { 'd.label$like': `%${ctx.body.keyword}%` }];
        }

        const result = await befly.db.getList({
            table: 'addon_admin_dict d',
            joins: [{ table: 'addon_admin_dict_type dt', on: 'd.type_code = dt.code' }],
            fields: ['d.id', 'd.typeCode', 'd.key', 'd.label', 'd.sort', 'd.remark', 'd.createdAt', 'd.updatedAt', 'dt.name AS typeName'],
            where: where,
            page: ctx.body.page,
            limit: ctx.body.limit,
            orderBy: ['d.sort#ASC', 'd.id#ASC']
        });

        return befly.tool.Yes('获取成功', result);
    }
};
