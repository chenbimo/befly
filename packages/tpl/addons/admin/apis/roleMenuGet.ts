import { Api, Yes, No } from 'befly';

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
            const menuRecords = await befly.db.getAll({
                table: 'admin_role_menu',
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
});
