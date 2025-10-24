import { Fields, Yes, No } from 'befly';
import type { ApiRoute } from 'befly';

/**
 * 获取字典列表
 */
export default {
    name: '获取字典列表',
    fields: {
        page: Fields._page,
        limit: Fields._limit
    },
    handler: async (befly, ctx) => {
        try {
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
        } catch (error) {
            befly.logger.error('获取字典列表失败:', error);
            return No('操作失败');
        }
    }
} as ApiRoute;
