/**
 * 创建文章接口 - TypeScript 示例
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { CreateArticleRequest } from '../../../types/api';

export default Api('创建文章', {
    method: 'POST',
    auth: false, // 临时关闭认证以测试插入逻辑
    fields: {
        title: '标题|string|1|200|null|0|null',
        content: '内容|text|1|100000|null|0|null',
        categoryId: '分类ID|number|1|999999|null|0|null',
        tags: '标签|array|0|10|[]|0|null',
        summary: '摘要|string|0|500|null|0|null',
        coverImage: '封面图|string|0|500|null|0|null'
    },
    required: ['title', 'content', 'categoryId'],
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
