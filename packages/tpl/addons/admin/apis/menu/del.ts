/**
 * 删除菜单
 */

import { Yes, No } from 'befly';

export default {
    name: '删除菜单',
    handler: async (befly, ctx) => {
        try {
            // 检查是否有子菜单（使用 getList 代替 getAll）
            const childrenList = await befly.db.getList({
                table: 'addon_admin_menu',
                where: { pid: ctx.body.id }
            });

            if (childrenList.total > 0) {
                return No('该菜单下有子菜单，无法删除');
            }

            // 删除菜单
            await befly.db.delData({
                table: 'addon_admin_menu',
                where: { id: ctx.body.id }
            });

            // 注意：菜单权限现在存储在 role.menus 字段中
            // 如果需要从角色权限中移除此菜单，需要额外处理
            // 这里暂时不处理，由管理员在角色管理界面手动调整

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('删除菜单失败:', error);
            return No('操作失败');
        }
    }
};
