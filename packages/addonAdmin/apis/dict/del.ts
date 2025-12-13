export default {
    name: '删除字典',
    fields: { '@id': true },
    required: ['id'],
    handler: async (befly, ctx) => {
        await befly.db.delData({
            table: 'addon_admin_dict',
            where: { id: ctx.body.id }
        });

        return befly.tool.Yes('删除成功');
    }
};
