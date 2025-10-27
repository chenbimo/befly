/**
 * 更新文章接口
 */

import { Yes, No, Field } from 'befly';

import articleTable from '../../tables/article.json';

export default {
    name: '更新文章',
    auth: false,
    fields: {
        id: Field._id,
        title: articleTable.title,
        content: articleTable.content,
        summary: articleTable.summary,
        coverImage: articleTable.coverImage,
        author: articleTable.author,
        category: articleTable.category,
        tags: articleTable.tags,
        viewCount: articleTable.viewCount,
        status: articleTable.status
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

        // 更新文章
        const result = await befly.db.updData({
            table: 'article',
            where: { id: ctx.body.id },
            data: {
                title: ctx.body.title,
                content: ctx.body.content,
                summary: ctx.body.summary,
                coverImage: ctx.body.coverImage,
                author: ctx.body.author,
                category: ctx.body.category,
                tags: ctx.body.tags,
                viewCount: ctx.body.viewCount,
                status: ctx.body.status
            }
        });

        return Yes('更新成功', { affected: result });
    }
};
