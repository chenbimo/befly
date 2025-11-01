import { Yes, No } from '../../../core/util.js';
import adminMenuTable from '../../../core/tables/menu.json';

export default {
    name: '更新菜单',
    fields: adminMenuTable,
    handler: async (befly, ctx) => {
        try {
            await befly.db.updData({
                table: 'core_menu',
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
