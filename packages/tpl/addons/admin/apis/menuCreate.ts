import { Api } from 'befly';
import adminMenuTable from '../tables/menu.json';

/**
 * 创建菜单
 */
export default Api('创建菜单', {
    method: 'POST',
    auth: true,
    fields: {
        name: adminMenuTable.name,
        path: adminMenuTable.path,
        icon: adminMenuTable.icon,
        sort: adminMenuTable.sort,
        pid: adminMenuTable.pid,
        type: adminMenuTable.type,
        status: adminMenuTable.status
    },
    handler: async (befly, ctx) => {
        try {
            const menuId = await befly.db.insData({
                table: 'admin_menu',
                data: ctx.body
            });

            return {
                ...befly.code.success,
                data: { id: menuId }
            };
        } catch (error) {
            befly.logger.error('创建菜单失败:', error);
            return befly.code.fail;
        }
    }
});
