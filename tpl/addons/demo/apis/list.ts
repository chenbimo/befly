/**
 * Demo Addon - 查询待办列表
 * 路由：GET /api/demo/list
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';

export default Api('查询待办列表', {
    method: 'GET',
    auth: false,
    fields: {
        completed: '是否完成|number|0|1|null|0|null',
        priority: '优先级|string|1|10|null|0|^(low|medium|high)$',
        page: '页码|number|1|9999|1|0|null',
        pageSize: '每页数量|number|1|100|10|0|null'
    },
    required: [],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        try {
            const page = ctx.body.page || 1;
            const pageSize = ctx.body.pageSize || 10;

            // 构建查询条件
            const where: any = {};
            if (ctx.body.completed !== undefined && ctx.body.completed !== null) {
                where.completed = ctx.body.completed;
            }
            if (ctx.body.priority) {
                where.priority = ctx.body.priority;
            }

            // 查询数据
            const todos = await befly.db.getData({
                table: 'demo_todo',
                where,
                page,
                pageSize,
                orderBy: { createdAt: 'desc' }
            });

            // 统计总数
            const total = await befly.db.getData({
                table: 'demo_todo',
                where,
                selectFields: ['count(*) as total']
            });

            // 使用插件格式化数据
            const demoTool = befly['demo.tool'];
            const formattedTodos = todos.map((todo: any) => demoTool.formatTodo(todo));

            return Yes('查询成功', {
                list: formattedTodos,
                pagination: {
                    page,
                    pageSize,
                    total: total[0]?.total || 0,
                    totalPages: Math.ceil((total[0]?.total || 0) / pageSize)
                }
            });
        } catch (error: any) {
            befly.logger.error('查询待办列表失败:', error);
            return No('查询失败');
        }
    }
});
