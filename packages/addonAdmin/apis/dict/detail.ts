export default {
    name: '获取字典详情',
    fields: { '@id': true },
    required: ['id'],
    handler: async (befly, ctx) => {
        const dict = await befly.db.getDetail({
            table: 'addon_admin_dict',
            where: { id: ctx.body.id }
        });

        if (!dict?.id) {
            return befly.tool.No('字典项不存在');
        }

        return befly.tool.Yes('获取成功', dict);
    }
};
