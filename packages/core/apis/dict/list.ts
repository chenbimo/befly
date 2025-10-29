import { Yes, No } from '../../util.js';
export default {
    name: '获取字典列表',
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: 'core_dict',
            fields: ['id', 'name', 'code', 'value', 'sort', 'pid', 'description', 'state', 'created_at', 'updated_at'],
            page: ctx.body.page,
            limit: ctx.body.limit,
            orderBy: [
                { field: 'sort', direction: 'ASC' },
                { field: 'id', direction: 'ASC' }
            ]
        });

        return Yes('操作成功', result);
    }
};
