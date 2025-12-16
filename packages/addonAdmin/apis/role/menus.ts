import adminRoleTable from '../../tables/role.json';

export default {
    name: '获取角色菜单权限',
    fields: {
        roleCode: adminRoleTable.code
    },
    handler: async (befly, ctx) => {
        // 查询角色信息
        const role = await befly.db.getOne({
            table: 'addon_admin_role',
            where: { code: ctx.body.roleCode }
        });

        if (!role?.id) {
            return befly.tool.No('角色不存在');
        }

        // 数据库自动将 array_number_string 转换为数组
        const menuIds = role.menus || [];

        return befly.tool.Yes('操作成功', menuIds);
    }
};
