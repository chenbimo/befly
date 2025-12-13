export default {
    name: '获取所有字典',
    handler: async (befly) => {
        const dicts = await befly.db.getAll({
            table: 'addon_admin_dict',
            fields: ['*'],
            orderBy: ['id#ASC']
        });

        return befly.tool.Yes('操作成功', { lists: dicts.lists });
    }
};
