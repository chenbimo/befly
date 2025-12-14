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

        if (!role?.id) {
            return befly.tool.No('角色不存在');
        }

        // 直接使用数组，数据库会自动处理存储
        await befly.db.updData({
            table: 'addon_admin_role',
            where: { code: ctx.body.roleCode },
            data: {
                menus: ctx.body.menuIds
            }
        });

        return befly.tool.Yes('操作成功');
    }
};
