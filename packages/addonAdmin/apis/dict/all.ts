export default {
    name: '获取所有字典',
    handler: async (befly) => {
        const dicts = await befly.db.getAll({
            table: 'addon_admin_dict',
            orderBy: ['sort#ASC', 'id#ASC']
        });

        return befly.tool.Yes('获取成功', dicts);
    }
};
