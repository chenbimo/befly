export default {
    name: '获取所有字典',
    handler: async (befly) => {
        const dicts = await befly.db.getAll({
            table: 'addon_admin_dict',
            fields: ['id', 'code', 'name', 'value'],
            orderBy: ['id#ASC']
        });

        return befly.tool.Yes('操作成功', { lists: dicts.lists });
    }
};
