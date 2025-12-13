import dictTypeTable from '../../tables/dictType.json';

export default {
    name: '添加字典类型',
    fields: dictTypeTable,
    required: ['code', 'name'],
    handler: async (befly, ctx) => {
        // 检查代码是否已存在
        const existing = await befly.db.getOne({
            table: 'addon_admin_dict_type',
            where: { code: ctx.body.code }
        });

        if (existing?.id) {
            return befly.tool.No('类型代码已存在');
        }

        const typeId = await befly.db.insData({
            table: 'addon_admin_dict_type',
            data: {
                code: ctx.body.code,
                name: ctx.body.name,
                description: ctx.body.description,
                sort: ctx.body.sort
            }
        });

        return befly.tool.Yes('添加成功', { id: typeId });
    }
};
