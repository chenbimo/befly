/**
 * 删除文章接口（软删除）
 */

import { Yes, No } from 'befly';

export default {
    name: '删除文章',
    auth: false,
    fields: {
        // id 会自动从默认字段合并
    },
    required: ['id'],
    handler: async (befly, ctx) => {
        // 检查文章是否存在
        const article = await befly.db.getOne({
            table: 'article',
            where: { id: ctx.body.id }
        });

        if (!article) {
            return No('文章不存在');
        }

        // 软删除
        const result = await befly.db.delData({
            table: 'article',
            where: { id: ctx.body.id }
        });

        return Yes('删除成功', { affected: result });
    }
};
