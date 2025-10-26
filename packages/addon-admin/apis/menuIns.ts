import { Yes, No } from 'befly';
import adminMenuTable from '../tables/menu.json';

/**
 * 创建菜单
 */
export default {
    name: '创建菜单',
    fields: {
        name: adminMenuTable.name,
        path: adminMenuTable.path,
        icon: adminMenuTable.icon,
        sort: adminMenuTable.sort,
        pid: adminMenuTable.pid,
        type: adminMenuTable.type
        // state 由框架自动设置为 1（正常）
    },
    handler: async (befly, ctx) => {
        try {
            const menuId = await befly.db.insData({
                table: 'addon_admin_menu',
                data: ctx.body
            });

            return Yes('操作成功', { id: menuId });
        } catch (error) {
            befly.logger.error('创建菜单失败:', error);
            return No('操作失败');
        }
    }
};
