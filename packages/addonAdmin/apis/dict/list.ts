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
        if (ctx.body.typeCode) where.typeCode = ctx.body.typeCode;
        if (ctx.body.keyword) {
            where.$or = [{ key$like: `%${ctx.body.keyword}%` }, { label$like: `%${ctx.body.keyword}%` }, { value$like: `%${ctx.body.keyword}%` }];
        }

        const result = await befly.db.getList({
            table: 'addon_admin_dict',
            fields: ['id', 'typeCode', 'key', 'label', 'value', 'sort', 'remark', 'created_at', 'updated_at'],
            where: where,
            page: ctx.body.page,
            limit: ctx.body.limit,
            orderBy: ['sort#ASC', 'id#ASC']
        });

        // 获取类型名称映射
        if (result.lists.length > 0) {
            const typeCodes = [...new Set(result.lists.map((item: any) => item.typeCode))];
            const types = await befly.db.getAll({
                table: 'addon_admin_dict_type',
                where: { code$in: typeCodes },
                fields: ['code', 'name']
            });

            const typeMap = new Map(types.lists.map((t: any) => [t.code, t.name]));
            result.lists.forEach((item: any) => {
                item.typeName = typeMap.get(item.typeCode) || '';
            });
        }

        return befly.tool.Yes('获取成功', result);
    }
};
