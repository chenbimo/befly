import { Api } from 'befly';

/**
 * 获取角色的菜单权限
 */
export default Api('获取角色菜单权限', {
    method: 'POST',
    auth: true,
    fields: {
        roleId: '角色ID|number|1|999999999999999|null|1|null'
    },
    handler: async (befly, ctx) => {
        try {
            const menuIds = await befly.db.query('SELECT menu_id FROM admin_role_menu WHERE role_id = ? AND deleted_at IS NULL', [ctx.body.roleId]);

            const ids = menuIds ? menuIds.map((item: any) => item.menu_id) : [];

            return {
                ...befly.code.success,
                data: ids
            };
        } catch (error) {
            befly.logger.error('获取角色菜单权限失败:', error);
            return befly.code.fail;
        }
    }
});
