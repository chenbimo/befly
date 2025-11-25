
export default {
    name: '获取所有字典',
    handler: async (befly, ctx) => {
        try {
            const dicts = await befly.db.getAll({
                table: 'addon_admin_dict',
                fields: ['id', 'name', 'code', 'value', 'sort', 'pid', 'description', 'state', 'created_at', 'updated_at'],
                orderBy: [
                    { field: 'sort', direction: 'ASC' },
                    { field: 'id', direction: 'ASC' }
                ]
            });

            return befly.tool.Yes('操作成功', dicts);
        } catch (error) {
            befly.logger.error('获取所有字典失败:', error);
            return befly.tool.No('操作失败');
        }
    }
};
