/**
 * 获取用户列表接口 - TypeScript 示例
 */

import { Yes, Field } from 'befly';

export default {
    name: '获取用户列表',
    auth: true, // 需要登录（权限由角色接口列表控制）
    fields: {
        page: Field.page,
        limit: Field.limit,
        role: '角色|string|0|20|null|0|^(admin|user|guest)$',
        keyword: Field.keyword
    },
    handler: async (befly, ctx) => {
        const params = ctx.body as GetUsersRequest;

        // 构建查询条件
        const where = {};
        if (params.role) {
            where.role = params.role;
        }
        if (params.keyword) {
            where.username = { $like: `%${params.keyword}%` };
        }

        // 查询用户列表（不返回密码字段）
        const result = await befly.db.getList({
            table: 'user',
            fields: ['id', 'username', 'email', 'role', 'avatar', 'nickname', 'createdAt', 'updatedAt'],
            where,
            page: params.page || 1,
            limit: params.limit || 10,
            orderBy: ['createdAt#DESC']
        });

        return Yes('查询成功', result);
    }
};
