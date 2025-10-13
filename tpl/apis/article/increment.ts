/**
 * 文章字段自增接口
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import commonFields from 'befly/tables/_common.json';

export default Api('文章字段自增', {
    method: 'POST',
    auth: false,
    fields: {
        id: commonFields.id,
        field: '字段名|string|1|50|null|1|^[a-zA-Z_][a-zA-Z0-9_]*$',
        value: '自增值|number|-999999|999999|1|0|null'
    },
    required: ['id', 'field'],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        const { id, field, value = 1 } = ctx.body;

        // 检查文章是否存在
        const article = await befly.db.getDetail({
            table: 'article',
            where: { id }
        });

        if (!article) {
            return No('文章不存在');
        }

        // 执行自增
        const result = await befly.db.increment({
            table: 'article',
            where: { id },
            field,
            value
        });

        return Yes('自增成功', { affected: result });
    }
});
