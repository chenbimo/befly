import { Field, Yes, No } from 'befly';
import type { ApiRoute } from 'befly';

/**
 * 获取字典列表
 */
export default {
    name: '获取字典列表',
    fields: {
        page: Field.page,
        limit: Field.limit
    },
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: 'addon_admin_dict',
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
} as ApiRoute;
