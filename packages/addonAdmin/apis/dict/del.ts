export default {
    name: '删除字典',
    fields: {
        id: '@id'
    },
    handler: async (befly, ctx) => {
        try {
            await befly.db.delData({
                table: 'addon_admin_dict',
                where: {
                    id: ctx.body.id
                }
            });

            return befly.tool.Yes('操作成功');
        } catch (error) {
            befly.logger.error({ err: error }, '删除字典失败');
            return befly.tool.No('操作失败');
        }
    }
};
