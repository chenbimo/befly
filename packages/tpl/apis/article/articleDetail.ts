/**
 * 获取文章详情接口
 */

import { Yes, No, Field } from 'befly';

export default {
    name: '获取文章详情',
    auth: false,
    fields: {
        id: Field._id
    },
    required: ['id'],
    handler: async (befly, ctx) => {
        const article = await befly.db.getOne({
            table: 'article',
            where: { id: ctx.body.id }
        });

        if (!article) {
            return No('文章不存在');
        }

        return Yes('获取成功', article);
    }
};
