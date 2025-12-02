export default {
    name: '获取操作日志列表',
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: 'addon_admin_operate_log',
            page: ctx.body.page || 1,
            limit: ctx.body.limit || 30,
            orderBy: ['operateTime#DESC']
        });

        return befly.tool.Yes('获取成功', result);
    }
};
