import type { ApiRoute } from 'befly';

export default {
    name: '获取接口列表（分页）',
    handler: async (befly, ctx) => {
        try {
            const { page = 1, limit = 30, keyword = '' } = ctx.body;

            // 构建查询条件
            const where: Record<string, any> = {};
            if (keyword) {
                where.$or = [{ name: { $like: `%${keyword}%` } }, { path: { $like: `%${keyword}%` } }];
            }

            const result = await befly.db.getList({
                table: 'addon_admin_api',
                fields: ['id', 'name', 'path', 'method', 'description', 'addon_name', 'addon_title'],
                where: where,
                orderBy: ['addon_name#ASC', 'path#ASC'],
                page: page,
                limit: limit
            });

            return befly.tool.Yes('操作成功', result);
        } catch (error: any) {
            befly.logger.error({ err: error }, '获取接口列表失败');
            return befly.tool.No('获取接口列表失败');
        }
    }
} as ApiRoute;
