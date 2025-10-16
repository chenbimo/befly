import { Yes, No, Fields } from 'befly';
import adminMenuTable from '../tables/menu.json';
import type { ApiRoute } from 'befly/types';

/**
 * 更新菜单
 */
export default {
    name: '更新菜单',
    fields: {
        id: Fields._id,
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
            await befly.db.updData({
                table: 'addon_admin_menu',
                where: { id: ctx.body.id },
                data: {
                    name: ctx.body.name,
                    path: ctx.body.path,
                    icon: ctx.body.icon,
                    sort: ctx.body.sort,
                    pid: ctx.body.pid,
                    type: ctx.body.type,
                    status: ctx.body.status
                }
            });

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('更新菜单失败:', error);
            return No('操作失败');
        }
    }
};
