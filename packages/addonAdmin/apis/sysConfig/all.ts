export default {
    name: '获取所有系统配置',
    handler: async (befly, ctx) => {
        const result = await befly.db.getAll({
            table: 'addon_admin_sys_config',
            orderBy: ['id#ASC']
        });

        return befly.tool.Yes('操作成功', { lists: result.lists });
    }
};
