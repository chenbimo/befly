import { Fields } from 'befly-core/config.js';

export default {
    name: '邮件发送日志列表',
    fields: {
        page: Fields.page,
        limit: Fields.limit
    },
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: 'addon_admin_email_log',
            page: ctx.body.page || 1,
            limit: ctx.body.limit || 30,
            orderBy: { sendTime: 'desc' }
        });

        return befly.tool.Yes('获取成功', result);
    }
};
