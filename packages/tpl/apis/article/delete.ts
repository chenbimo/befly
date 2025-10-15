/**
 * 删除文章接口（软删除）
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import commonFields from 'befly/tables/_common.json';

export default Api('删除文章', {
    method: 'POST',
    auth: false,
    fields: {
        id: commonFields._id
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

        // 软删除
        const result = await befly.db.delData({
            table: 'article',
            where: { id: ctx.body.id }
        });

        return Yes('删除成功', { affected: result });
    }
});
