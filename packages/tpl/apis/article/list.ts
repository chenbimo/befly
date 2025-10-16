/**
 * 获取文章列表接口 - TypeScript 示例
 */

import { Api, Yes, No, Fields } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { GetArticlesRequest, GetArticlesResponse } from '../../../types/api';
import type { Article } from '../../../types/models';

export default Api('获取文章列表', {
    method: 'POST',
    auth: false, // 公开接口
    fields: {
        page: Fields.page,
        limit: Fields.limit,
        categoryId: '分类ID|number|0|999999|null|0|null',
        authorId: '作者ID|number|0|999999|null|0|null',
        keyword: Fields.keyword,
        published: '是否发布|number|0|1|null|0|^(0|1)$'
    },
    required: [],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        // 构建查询条件
        let where: any = params.where || {};

        // 兼容旧的查询参数
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
        const result = await befly.db.getList({
            table: 'article',
            where,
            page: params.page || 1,
            limit: params.limit || 10,
            orderBy: params.orderBy || ['created_at#DESC']
        });

        return Yes('查询成功', result);
    }
});
