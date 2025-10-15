import { Api } from 'befly';

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
            const adminRoles = await befly.db.query('SELECT id FROM admin_admin_role WHERE role_id = ? AND deleted_at IS NULL', [ctx.body.id]);

            if (adminRoles && adminRoles.length > 0) {
                return {
                    ...befly.code.fail,
                    msg: '该角色已分配给用户，无法删除'
                };
            }

            // 删除角色
            await befly.db.delData({
                table: 'admin_role',
                where: { id: ctx.body.id }
            });

            // 删除相关的角色-菜单关联
            await befly.db.query('UPDATE admin_role_menu SET deleted_at = ? WHERE role_id = ?', [Date.now(), ctx.body.id]);

            return befly.code.success;
        } catch (error) {
            befly.logger.error('删除角色失败:', error);
            return befly.code.fail;
        }
    }
});
