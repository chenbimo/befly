import { Api } from 'befly';

/**
 * 删除菜单
 */
export default Api('删除菜单', {
    method: 'POST',
    auth: true,
    fields: {
        id: '菜单ID|number|1|999999999999999|null|1|null'
    },
    handler: async (befly, ctx) => {
        try {
            // 检查是否有子菜单
            const children = await befly.db.query('SELECT id FROM admin_menu WHERE pid = ? AND deleted_at IS NULL', [ctx.body.id]);

            if (children && children.length > 0) {
                return {
                    ...befly.code.fail,
                    msg: '该菜单下有子菜单，无法删除'
                };
            }

            // 删除菜单
            await befly.db.delData({
                table: 'admin_menu',
                where: { id: ctx.body.id }
            });

            // 删除相关的角色-菜单关联
            await befly.db.query('UPDATE admin_role_menu SET deleted_at = ? WHERE menu_id = ?', [Date.now(), ctx.body.id]);

            return befly.code.success;
        } catch (error) {
            befly.logger.error('删除菜单失败:', error);
            return befly.code.fail;
        }
    }
});
