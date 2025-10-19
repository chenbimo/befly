/**
 * 获取角色的菜单权限
 */

import { Yes, No, Fields } from 'befly';

export default {
    name: '获取角色菜单权限',
    fields: {
        roleId: Fields._id
    },
    handler: async (befly, ctx) => {
        try {
            // 查询角色信息
            const role = await befly.db.getOne({
                table: 'addon_admin_role',
                where: { id: ctx.body.roleId }
            });

            if (!role) {
                return No('角色不存在');
            }

            // 解析菜单ID列表（逗号分隔的字符串转为数组）
            const menuIds = role.menus
                ? role.menus
                      .split(',')
                      .map((id: string) => parseInt(id.trim()))
                      .filter((id: number) => !isNaN(id))
                : [];

            return Yes('操作成功', menuIds);
        } catch (error) {
            befly.logger.error('获取角色菜单权限失败:', error);
            return No('操作失败');
        }
    }
};
