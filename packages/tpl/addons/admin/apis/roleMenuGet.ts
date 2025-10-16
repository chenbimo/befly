/**
 * 获取角色的菜单权限
 */

import { Yes, No, Fields } from 'befly';
export default {
    name: '获取角色菜单权限',
    fields: {
        roleId: Fields._id
    },
    handler: async (befly, ctx) => {
        try {
            const menuRecords = await befly.db.getAll({
                table: 'addon_admin_role_menu',
                fields: ['menu_id'],
                where: { role_id: ctx.body.roleId }
            });

            const ids = menuRecords.map((item: any) => item.menu_id);

            return Yes('操作成功', ids);
        } catch (error) {
            befly.logger.error('获取角色菜单权限失败:', error);
            return No('操作失败');
        }
    }
};
