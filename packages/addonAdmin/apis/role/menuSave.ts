import adminRoleTable from '../../tables/role.json';

export default {
    name: '保存角色菜单权限',
    fields: {
        roleCode: adminRoleTable.code,
        menuIds: adminRoleTable.menus
    },
    handler: async (befly, ctx) => {
        // 查询角色是否存在
        const role = await befly.db.getOne({
            table: 'addon_admin_role',
            where: { code: ctx.body.roleCode }
        });

        if (!role) {
            return befly.tool.No('角色不存在');
        }

        // 将数组转为逗号分隔的字符串存储
        const menuIdsStr = Array.isArray(ctx.body.menuIds) ? ctx.body.menuIds.join(',') : '';

        // 更新角色的菜单权限
        await befly.db.updData({
            table: 'addon_admin_role',
            where: { code: ctx.body.roleCode },
            data: {
                menus: menuIdsStr
            }
        });

        return befly.tool.Yes('操作成功');
    }
};
