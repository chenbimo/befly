/**
 * Demo Addon - 创建待办事项
 * 路由：POST /api/demo/create
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';

export default Api('创建待办事项', {
    fields: {
        title: '标题|string|1|100|null|0|null',
        content: '内容|string|0|500||0|null',
        priority: '优先级|string|1|10|medium|0|^(low|medium|high)$'
    },
    required: ['title'],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        // 插入数据到 demo_todo 表
        const result = await befly.db.insData({
            table: 'demo_todo',
            data: {
                title: ctx.body.title,
                content: ctx.body.content || '',
                priority: ctx.body.priority || 'medium',
                completed: 0
            }
        });

        return Yes('待办创建成功', {
            id: result,
            title: ctx.body.title,
            content: ctx.body.content || '',
            priority: ctx.body.priority || 'medium'
        });
    }
});
