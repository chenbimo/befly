/**
 * 获取文章列表接口 - TypeScript 示例
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { GetArticlesRequest, GetArticlesResponse } from '../../../types/api';
import type { Article } from '../../../types/models';

export default Api('获取文章列表', {
    method: 'POST',
    auth: false, // 公开接口
    fields: {
        page: '页码|number|1|9999|1|0|null',
        limit: '每页数量|number|1|100|10|0|null',
        categoryId: '分类ID|number|0|999999|null|0|null',
        authorId: '作者ID|number|0|999999|null|0|null',
        keyword: '关键词|string|0|50|null|0|null',
        published: '是否发布|number|0|1|null|0|^(0|1)$'
    },
    required: [],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        const params = ctx.body as GetArticlesRequest;

        // 构建查询条件
        const where: any = {};
        if (params.categoryId) {
            where.categoryId = params.categoryId;
        }
        if (params.authorId) {
            where.authorId = params.authorId;
        }
        if (params.keyword) {
            where.title = { $like: `%${params.keyword}%` };
        }
        if (typeof params.published !== 'undefined') {
            where.published = params.published;
        }

        // 查询文章列表
        const result = await befly.db.getList<Article>({
            table: 'article',
            where,
            page: params.page || 1,
            limit: params.limit || 10,
            orderBy: ['created_at#DESC']
        });

        return Yes<GetArticlesResponse>('查询成功', result);
    }
});
