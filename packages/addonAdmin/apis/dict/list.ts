export default {
    name: '获取字典列表',
    fields: {
        page: '@page',
        limit: '@limit',
        typeCode: { type: 'string', label: '类型代码' },
        keyword: '@keyword'
    },
    handler: async (befly, ctx) => {
        const where: any = {};
        if (ctx.body.typeCode) where['addon_admin_dict.typeCode'] = ctx.body.typeCode;
        if (ctx.body.keyword) {
            where.$or = [{ 'addon_admin_dict.key$like': `%${ctx.body.keyword}%` }, { 'addon_admin_dict.label$like': `%${ctx.body.keyword}%` }];
        }

        const result = await befly.db.getList({
            table: 'addon_admin_dict',
            joins: [
                //
                {
                    table: 'addon_admin_dict_type',
                    on: 'addon_admin_dict.type_code = addon_admin_dict_type.code'
                }
            ],
            fields: [
                //
                'addon_admin_dict.id',
                'addon_admin_dict.typeCode',
                'addon_admin_dict.key',
                'addon_admin_dict.label',
                'addon_admin_dict.sort',
                'addon_admin_dict.remark',
                'addon_admin_dict.createdAt',
                'addon_admin_dict.updatedAt',
                'addon_admin_dict_type.name AS typeName'
            ],
            where: where,
            page: ctx.body.page,
            limit: ctx.body.limit,
            orderBy: ['addon_admin_dict.sort#ASC', 'addon_admin_dict.id#ASC']
        });

        return befly.tool.Yes('获取成功', result);
    }
};
