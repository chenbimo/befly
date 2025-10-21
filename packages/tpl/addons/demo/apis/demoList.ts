/**
 * Demo Addon - 查询待办列表
 * 路由：GET /api/demo/list
 */

import { Yes, Fields } from 'befly';

export default {
    name: '查询待办列表',
    auth: false,
    fields: {
        completed: '是否完成|number|0|1|null|0|null',
        priority: '优先级|string|1|10|null|0|^(low|medium|high)$',
        page: Fields.page,
        limit: '每页数量|number|1|100|10|0|null'
    },
    handler: async (befly, ctx) => {
        // 查询数据（使用 getList 方法，带分页）
        const result = await befly.db.getList({
            table: 'addon_demo_todo',
            where: {
                completed: ctx.body.completed,
                priority: ctx.body.priority
            },
            page: ctx.body.page,
            limit: ctx.body.limit,
            orderBy: ['created_at#DESC']
        });

        // 暂时不使用插件格式化，直接返回原始数据
        // const demoTool = befly['demo.tool'];
        // const formattedTodos = result.list.map((todo: any) => demoTool.formatTodo(todo));

        return Yes('查询成功', result);
    }
};
