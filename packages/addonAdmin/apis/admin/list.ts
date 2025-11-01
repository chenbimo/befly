/**
 * 获取管理员列表
 */

import { Yes } from 'befly';

export default {
    name: '获取管理员列表',
    handler: async (befly, ctx) => {
        // 查询所有管理员（框架自动排除password字段，自动转换字段名为小驼峰）
        const result = await befly.db.getList({
            table: 'addon_admin_admin',
            page: ctx.body.page || 1,
            limit: ctx.body.limit || 10,
            orderBy: ['createdAt#DESC']
        });

        return Yes('获取成功', result);
    }
};
