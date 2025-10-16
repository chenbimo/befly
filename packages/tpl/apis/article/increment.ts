/**
 * 文章字段增量接口
 */

import { Yes, No, Fields } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { ApiRoute } from 'befly/types';

export default {
    name: '文章字段增量',
    auth: false,
    fields: {
        id: Fields._id,
        field: '字段名|string|1|50|null|1|^[a-zA-Z_][a-zA-Z0-9_]*
,
        value: '自增值|number|-999999|999999|1|0|null'
    },
    required: ['id', 'field'],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        // 检查文章是否存在
        const article = await befly.db.getDetail({
            table: 'article',
            where: { id: ctx.body.id }
        });

        if (!article) {
            return No('文章不存在');
        }

        // 执行自增
        const result = await befly.db.increment({
            table: 'article',
            where: { id: ctx.body.id },
            field: ctx.body.field,
            value: ctx.body.value || 1
        });

        return Yes('自增成功', { affected: result });
    }
}
