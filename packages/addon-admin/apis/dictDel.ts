import { Fields, Yes, No } from 'befly';
import type { ApiRoute } from 'befly';

/**
 * 删除字典
 */
export default {
    name: '删除字典',
    fields: {
        id: Fields._id
    },
    handler: async (befly, ctx) => {
        try {
            await befly.db.delData({
                table: 'addon_admin_dict',
                where: {
                    id: ctx.body.id
                }
            });

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('删除字典失败:', error);
            return No('操作失败');
        }
    }
} as ApiRoute;
