export default {
    name: '获取登录日志列表',
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: 'addon_admin_login_log',
            page: ctx.body.page || 1,
            limit: ctx.body.limit || 30,
            orderBy: ['loginTime#DESC']
        });

        return befly.tool.Yes('获取成功', result);
    }
};
