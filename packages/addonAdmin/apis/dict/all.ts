export default {
    name: '获取所有字典',
    handler: async (befly) => {
        const dicts = await befly.db.getAll({
            table: 'addon_admin_dict',
            fields: ['id', 'typeCode', 'key', 'label', 'value', 'sort', 'remark'],
            orderBy: ['sort#ASC', 'id#ASC']
        });

        return befly.tool.Yes('获取成功', dicts);
    }
};
