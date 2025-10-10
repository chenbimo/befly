/**
 * 创建文章接口 - TypeScript 示例
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { CreateArticleRequest } from '../../../types/api';

export default Api.POST(
    '创建文章',
    true, // 需要登录
    {
        title: '标题⚡string⚡1⚡200⚡null⚡0⚡null',
        content: '内容⚡text⚡1⚡100000⚡null⚡0⚡null',
        categoryId: '分类ID⚡number⚡1⚡999999⚡null⚡0⚡null',
        tags: '标签⚡array⚡0⚡10⚡[]⚡0⚡null',
        summary: '摘要⚡string⚡0⚡500⚡null⚡0⚡null',
        coverImage: '封面图⚡string⚡0⚡500⚡null⚡0⚡null'
    },
    ['title', 'content', 'categoryId'],
    async (befly: BeflyContext, ctx: RequestContext) => {
        try {
            const data = ctx.body as CreateArticleRequest;
            const userId = ctx.jwt?.userId;

            if (!userId) {
                return No('用户未登录');
            }

            // 插入文章
            const articleId = await befly.db.insData({
                table: 'article',
                data: {
                    ...data,
                    authorId: parseInt(userId),
                    viewCount: 0,
                    published: false
                }
            });

            return Yes('创建成功', { articleId });
        } catch (error: any) {
            befly.logger.error({
                msg: '创建文章失败',
                error: error.message
            });
            return No('创建失败');
        }
    }
);
