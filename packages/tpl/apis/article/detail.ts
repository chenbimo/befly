/**
 * 文章详情接口
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import commonFields from 'befly/tables/_common.json';

export default Api('文章详情', {
    method: 'POST',
    auth: false,
    fields: {
        id: commonFields._id
    },
    required: ['id'],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        const article = await befly.db.getDetail({
            table: 'article',
            where: { id: ctx.body.id }
        });

        if (!article) {
            return No('文章不存在');
        }

        return Yes('获取成功', article);
    }
});
