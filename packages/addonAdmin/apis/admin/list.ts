import { Yes } from 'befly';

export default {
    name: '获取管理员列表',
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: 'addon_admin_admin',
            page: ctx.body.page || 1,
            limit: ctx.body.limit || 10,
            where: {
                roleCode: {
                    $ne: 'dev'
                }
            },
            orderBy: ['createdAt#DESC']
        });

        return befly.tool.Yes('获取成功', result);
    }
};
