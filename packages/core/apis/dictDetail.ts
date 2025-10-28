import { Field, Yes, No } from 'befly';
import type { ApiRoute } from 'befly';

/**
 * 获取字典详情
 */
export default {
    name: '获取字典详情',
    fields: {
        id: Field._id
    },
    handler: async (befly, ctx) => {
        try {
            const dict = await befly.db.getDetail({
                table: 'addon_admin_dict',
                fields: ['id', 'name', 'code', 'value', 'sort', 'pid', 'description', 'state', 'created_at', 'updated_at'],
                where: {
                    id: ctx.body.id
                }
            });

            return Yes('操作成功', dict);
        } catch (error) {
            befly.logger.error('获取字典详情失败:', error);
            return No('操作失败');
        }
    }
} as ApiRoute;
