import adminMenuTable from '../../tables/menu.json';

export default {
    name: '创建菜单',
    fields: adminMenuTable,
    handler: async (befly, ctx) => {
        try {
            const menuId = await befly.db.insData({
                table: 'addon_admin_menu',
                data: ctx.body
            });

            return befly.tool.Yes('操作成功', { id: menuId });
        } catch (error: any) {
            befly.logger.error({ err: error }, '创建菜单失败');
            return befly.tool.No('操作失败');
        }
    }
};
