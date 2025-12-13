export default {
    name: '获取字典详情',
    fields: { '@id': true },
    required: ['id'],
    handler: async (befly, ctx) => {
        const dict = await befly.db.getOne({
            table: 'addon_admin_dict d',
            joins: [{ table: 'addon_admin_dict_type dt', on: 'd.type_code = dt.code' }],
            fields: ['d.id', 'd.typeCode', 'd.key', 'd.label', 'd.sort', 'd.remark', 'd.createdAt', 'd.updatedAt', 'dt.name AS typeName'],
            where: { 'd.id': ctx.body.id }
        });

        if (!dict?.id) {
            return befly.tool.No('字典项不存在');
        }

        return befly.tool.Yes('获取成功', dict);
    }
};
