import { Api, Yes, No } from 'befly';

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
            // 解析菜单 ID 数组
            let menuIdArray: number[] = [];
            try {
                menuIdArray = typeof ctx.body.menuIds === 'string' ? JSON.parse(ctx.body.menuIds) : ctx.body.menuIds;
            } catch {
                menuIdArray = [];
            }

            // 先删除该角色的所有菜单权限（软删除）
            await befly.db.updData({
                table: 'admin_role_menu',
                where: { role_id: ctx.body.roleId },
                data: { deleted_at: Date.now() }
            });

            // 批量插入新的权限
            if (menuIdArray.length > 0) {
                for (const menuId of menuIdArray) {
                    await befly.db.insData({
                        table: 'admin_role_menu',
                        data: {
                            role_id: ctx.body.roleId,
                            menu_id: menuId
                        }
                    });
                }
            }

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('保存角色菜单权限失败:', error);
            return No('操作失败');
        }
    }
});
