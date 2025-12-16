export default {
    name: '获取所有角色',
    handler: async (befly) => {
        const roles = await befly.db.getAll({
            table: 'addon_admin_role',
            where: {
                code: {
                    $ne: 'dev'
                }
            },
            orderBy: ['sort#ASC', 'id#ASC']
        });

        return befly.tool.Yes('操作成功', { lists: roles.lists, total: roles.total });
    }
};
