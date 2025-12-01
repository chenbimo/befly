export default {
    name: '邮件发送日志列表',
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: 'addon_admin_email_log',
            page: ctx.body.page || 1,
            limit: ctx.body.limit || 30,
            orderBy: ['sendTime#DESC']
        });

        return befly.tool.Yes('获取成功', result);
    }
};
