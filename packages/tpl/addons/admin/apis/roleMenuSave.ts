/**
 * 保存角色的菜单权限
 */

import { Yes, No, Fields } from 'befly';

export default {
    name: '保存角色菜单权限',
    fields: {
        roleId: Fields._id,
        menuIds: '菜单ID列表|string|0|10000|null|0|null'
    },
    handler: async (befly, ctx) => {
        // 查询角色是否存在
        const role = await befly.db.getOne({
            table: 'addon_admin_role',
            where: { id: ctx.body.roleId }
        });

        if (!role) {
            return No('角色不存在');
        }

        // menuIds 可能是 JSON 字符串或逗号分隔的字符串
        let menuIdsStr = '';
        if (ctx.body.menuIds) {
            try {
                // 尝试解析 JSON
                const parsed = JSON.parse(ctx.body.menuIds);
                if (Array.isArray(parsed)) {
                    menuIdsStr = parsed.join(',');
                } else {
                    menuIdsStr = ctx.body.menuIds;
                }
            } catch {
                // 如果不是 JSON，直接使用
                menuIdsStr = ctx.body.menuIds;
            }
        }

        // 更新角色的菜单权限
        await befly.db.updData({
            table: 'addon_admin_role',
            where: { id: ctx.body.roleId },
            data: {
                menus: menuIdsStr
            }
        });

        return Yes('操作成功');
    }
};
