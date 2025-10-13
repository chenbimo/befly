/**
 * 创建文章接口 - TypeScript 示例
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { CreateArticleRequest } from '../../../types/api';
import articleTable from '../../tables/article.json';

export default Api('创建文章', {
    method: 'POST',
    auth: false, // 临时关闭认证以测试插入逻辑
    fields: {
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
    required: ['title', 'content'],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        const data = ctx.body as CreateArticleRequest;
        const userId = ctx.jwt?.userId || '1'; // 临时使用固定ID测试

        // 插入文章
        const articleId = await befly.db.insData({
            table: 'article',
            data: {
                ...data,
                authorId: parseInt(userId),
                viewCount: 0,
                published: 0
            }
        });

        return Yes('创建成功', { articleId });
    }
});
