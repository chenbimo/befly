/**
 * 删除菜单
 */

import { Yes, No } from 'befly';
export default {
    name: '删除菜单',
    method: 'POST',
    auth: true,
    fields: {
        id: '菜单ID|number|1|999999999999999|null|1|null'
    },
    handler: async (befly, ctx) => {
        try {
            // 检查是否有子菜单
            const children = await befly.db.getAll({
                table: 'addon_admin_menu',
                fields: ['id'],
                where: { pid: ctx.body.id }
            });

            if (children.length > 0) {
                return No('该菜单下有子菜单，无法删除');
            }

            // 删除菜单
            await befly.db.delData({
                table: 'addon_admin_menu',
                where: { id: ctx.body.id }
            });

            // 删除相关的角色-菜单关联（软删除）
            await befly.db.delData({
                table: 'addon_admin_role_menu',
                where: { menu_id: ctx.body.id }
            });

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('删除菜单失败:', error);
            return No('操作失败');
        }
    }
};
