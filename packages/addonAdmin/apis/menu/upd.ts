import adminMenuTable from '../../tables/menu.json';

export default {
    name: '更新菜单',
    fields: adminMenuTable,
    handler: async (befly, ctx) => {
        try {
            await befly.db.updData({
                table: 'addon_admin_menu',
                where: { id: ctx.body.id },
                data: {
                    name: ctx.body.name,
                    path: ctx.body.path,
                    icon: ctx.body.icon,
                    sort: ctx.body.sort,
                    pid: ctx.body.pid
                    // state 字段不在此处更新，需要禁用/启用时单独处理
                }
            });

            return befly.tool.Yes('操作成功');
        } catch (error: any) {
            befly.logger.error({ err: error }, '更新菜单失败');
            return befly.tool.No('操作失败');
        }
    }
};
