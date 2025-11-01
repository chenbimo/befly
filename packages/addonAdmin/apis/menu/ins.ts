import { Yes, No } from 'befly';
import adminMenuTable from '../../tables/menu.json';

export default {
    name: '创建菜单',
    fields: adminMenuTable,
    handler: async (befly, ctx) => {
        try {
            const menuId = await befly.db.insData({
                table: 'core_menu',
                data: ctx.body
            });

            return Yes('操作成功', { id: menuId });
        } catch (error) {
            befly.logger.error('创建菜单失败:', error);
            return No('操作失败');
        }
    }
};
