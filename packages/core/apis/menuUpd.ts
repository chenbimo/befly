import { Yes, No, Field } from 'befly';
import adminMenuTable from '../tables/menu.json';

/**
 * 更新菜单
 */
export default {
    name: '更新菜单',
    fields: {
        id: Field._id,
        name: adminMenuTable.name,
        path: adminMenuTable.path,
        icon: adminMenuTable.icon,
        sort: adminMenuTable.sort,
        pid: adminMenuTable.pid,
        type: adminMenuTable.type
        // state 需要禁用时传 2，启用时传 1
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
                    type: ctx.body.type
                    // state 字段不在此处更新，需要禁用/启用时单独处理
                }
            });

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('更新菜单失败:', error);
            return No('操作失败');
        }
    }
};
