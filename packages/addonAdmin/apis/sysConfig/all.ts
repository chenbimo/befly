export default {
    name: '获取全部系统配置',
    handler: async (befly, ctx) => {
        const result = await befly.db.getAll({
            table: 'addon_admin_sys_config',
            fields: ['id', 'name', 'code', 'value', 'valueType', 'group', 'sort', 'isSystem', 'description'],
            orderBy: ['group#ASC', 'sort#ASC', 'id#ASC']
        });

        return befly.tool.Yes('操作成功', result);
    }
};
