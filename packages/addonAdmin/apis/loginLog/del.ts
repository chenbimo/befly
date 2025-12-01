export default {
    name: '删除登录日志',
    fields: {
        id: {
            name: 'ID',
            type: 'number',
            required: true
        }
    },
    handler: async (befly, ctx) => {
        await befly.db.delData({
            table: 'addon_admin_login_log',
            where: {
                id: ctx.body.id
            }
        });

        return befly.tool.Yes('删除成功');
    }
};
