export default {
    name: '获取角色菜单权限',
    handler: async (befly, ctx) => {
        // 查询角色信息
        const role = await befly.db.getOne({
            table: 'addon_admin_role',
            where: { id: ctx.body.roleId }
        });

        if (!role) {
            return befly.tool.No('角色不存在');
        }

        // 解析菜单ID列表（逗号分隔的字符串转为数组）
        const menuIds = role.menus
            ? role.menus
                  .split(',')
                  .map((id: string) => parseInt(id.trim()))
                  .filter((id: number) => !isNaN(id))
            : [];

        return befly.tool.Yes('操作成功', menuIds);
    }
};
