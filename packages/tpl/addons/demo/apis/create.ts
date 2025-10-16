/**
 * Demo Addon - 创建待办事项
 * 路由：POST /api/demo/create
 */

import type { BeflyContext, RequestContext } from 'befly/types';
import { Fields } from 'befly';
import type { ApiRoute } from 'befly/types';
export default {
    name: '创建待办事项',
    auth: false,
    fields: {
        title: Fields.title,
        content: '内容|string|0|500|null|0|null',
        priority: '优先级|string|1|10|medium|0|^(low|medium|high)$'
    },
    required: ['title'],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        // 插入数据到 demo_todo 表
        const result = await befly.db.insData({
            table: 'addon_demo_todo',
            data: {
                title: ctx.body.title,
                content: ctx.body.content || '',
                priority: ctx.body.priority || 'medium',
                completed: 0
            }
        });

        return {
            code: 0,
            msg: '待办创建成功',
            data: {
                id: result,
                title: ctx.body.title,
                content: ctx.body.content || '',
                priority: ctx.body.priority || 'medium'
            }
        };
    }
} as ApiRoute;
