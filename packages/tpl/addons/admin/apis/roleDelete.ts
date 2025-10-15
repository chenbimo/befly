import { Api, Yes, No } from 'befly';

/**
 * 删除角色
 */
export default Api('删除角色', {
    method: 'POST',
    auth: true,
    fields: {
        id: '角色ID|number|1|999999999999999|null|1|null'
    },
    handler: async (befly, ctx) => {
        try {
            // 检查是否有用户关联此角色
            const adminRoles = await befly.db.getAll({
                table: 'admin_admin_role',
                fields: ['id'],
                where: { role_id: ctx.body.id }
            });

            if (adminRoles.length > 0) {
                return No('该角色已分配给用户，无法删除');
            }

            // 删除角色
            await befly.db.delData({
                table: 'admin_role',
                where: { id: ctx.body.id }
            });

            // 删除相关的角色-菜单关联（软删除）
            await befly.db.updData({
                table: 'admin_role_menu',
                where: { role_id: ctx.body.id },
                data: { deleted_at: Date.now() }
            });

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('删除角色失败:', error);
            return No('操作失败');
        }
    }
});
