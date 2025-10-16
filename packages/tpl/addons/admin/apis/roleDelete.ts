/**
 * 删除角色
 */

import { Yes, No, Fields } from 'befly';
export default {
    name: '删除角色',
    fields: {
        id: Fields._id
    },
    handler: async (befly, ctx) => {
        try {
            // 检查是否有用户关联此角色
            const adminRoles = await befly.db.getAll({
                table: 'addon_admin_admin_role',
                fields: ['id'],
                where: { role_id: ctx.body.id }
            });

            if (adminRoles.length > 0) {
                return No('该角色已分配给用户，无法删除');
            }

            // 删除角色
            await befly.db.delData({
                table: 'addon_admin_role',
                where: { id: ctx.body.id }
            });

            // 删除相关的角色-菜单关联（软删除）
            await befly.db.delData({
                table: 'addon_admin_role_menu',
                where: { role_id: ctx.body.id }
            });

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('删除角色失败:', error);
            return No('操作失败');
        }
    }
};
