import { Api } from 'befly';
import adminMenuTable from '../tables/adminMenu.json';

/**
 * 更新菜单
 */
export default Api('更新菜单', {
    method: 'POST',
    auth: true,
    fields: {
        id: '菜单ID|number|1|999999999999999|null|1|null',
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
            const { id, ...data } = ctx.body;

            await befly.db.updData({
                table: 'admin_menu',
                where: { id },
                data
            });

            return befly.code.success;
        } catch (error) {
            befly.logger.error('更新菜单失败:', error);
            return befly.code.fail;
        }
    }
});
