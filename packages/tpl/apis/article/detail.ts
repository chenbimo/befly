/**
 * 获取文章详情接口
 */

import { Api, Yes, No, Fields } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';

export default Api('获取文章详情', {
    method: 'POST',
    auth: false,
    fields: {
        id: Fields._id
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
