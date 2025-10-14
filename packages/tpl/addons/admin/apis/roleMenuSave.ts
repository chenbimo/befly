import { Api } from 'befly';

/**
 * 保存角色的菜单权限
 */
export default Api('保存角色菜单权限', {
    method: 'POST',
    auth: true,
    fields: {
        roleId: '角色ID|number|1|999999999999999|null|1|null',
        menuIds: '菜单ID列表|string|0|10000|[]|0|null'
    },
    handler: async (befly, ctx) => {
        try {
            const { roleId, menuIds } = ctx.body;

            // 解析菜单 ID 数组
            let menuIdArray: number[] = [];
            try {
                menuIdArray = typeof menuIds === 'string' ? JSON.parse(menuIds) : menuIds;
            } catch {
                menuIdArray = [];
            }

            // 先删除该角色的所有菜单权限
            await befly.db.query('UPDATE admin_role_menu SET deleted_at = ? WHERE role_id = ?', [Date.now(), roleId]);

            // 批量插入新的权限
            if (menuIdArray.length > 0) {
                for (const menuId of menuIdArray) {
                    await befly.db.insData({
                        table: 'admin_role_menu',
                        data: {
                            role_id: roleId,
                            menu_id: menuId
                        }
                    });
                }
            }

            return befly.code.success;
        } catch (error) {
            befly.logger.error('保存角色菜单权限失败:', error);
            return befly.code.fail;
        }
    }
});
