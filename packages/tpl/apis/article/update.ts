/**
 * 更新文章接口
 */

import { Yes, No, Fields } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { ApiRoute } from 'befly/types';
import articleTable from '../../tables/article.json';

export default {
    name: '更新文章',
    auth: false,
    fields: {
        id: Fields._id,
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
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        // 检查文章是否存在
        const article = await befly.db.getDetail({
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
