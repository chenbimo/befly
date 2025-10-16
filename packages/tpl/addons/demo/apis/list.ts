/**
 * Demo Addon - 查询待办列表
 * 路由：GET /api/demo/list
 */

import { Yes } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { ApiRoute } from 'befly/types';

export default {
    name: '查询待办列表',
    auth: false,
    fields: {
        completed: '是否完成|number|0|1|null|0|null',
        priority: '优先级|string|1|10|null|0|^(low|medium|high)$',
        page: '页码|number|1|9999|1|0|null',
        pageSize: '每页数量|number|1|100|10|0|null'
    },
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
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

        // 查询数据（使�?getList 方法，带分页�?
        const result = await befly.db.getList({
            table: 'addon_demo_todo',
            where,
            page,
            limit: pageSize,
            orderBy: ['created_at#DESC'],
            includeDeleted: true // 暂时包含所有数据进行测�?
        });

        // 暂时不使用插件格式化，直接返回原始数�?        // const demoTool = befly['demo.tool'];
        // const formattedTodos = result.list.map((todo: any) => demoTool.formatTodo(todo));

        return Yes('查询成功', {
            list: result.list,
            pagination: {
                page: result.page,
                pageSize: result.limit,
                total: result.total,
                totalPages: result.pages
            }
        });
    }
};
