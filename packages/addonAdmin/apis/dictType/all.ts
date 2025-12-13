export default {
    name: '获取所有字典类型',
    handler: async (befly, ctx) => {
        const result = await befly.db.getAll({
            table: 'addon_admin_dict_type',
            fields: ['id', 'code', 'name', 'description', 'sort'],
            orderBy: ['sort#ASC', 'id#ASC']
        });

        return befly.tool.Yes('操作成功', { lists: result.lists });
    }
};
