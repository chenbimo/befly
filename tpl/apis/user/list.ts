/**
 * 获取用户列表接口 - TypeScript 示例
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { GetUsersRequest, GetUsersResponse } from '../../../types/api';
import type { User } from '../../../types/models';

export default Api('获取用户列表', {
    method: 'POST',
    auth: ['admin'], // 仅管理员可访问
    fields: {
        page: '页码|number|1|9999|1|0|null',
        limit: '每页数量|number|1|100|10|0|null',
        role: '角色|string|0|20|null|0|^(admin|user|guest)$',
        keyword: '关键词|string|0|50|null|0|null'
    },
    required: [],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        const params = ctx.body as GetUsersRequest;

        // 构建查询条件
        const where: any = {};
        if (params.role) {
            where.role = params.role;
        }
        if (params.keyword) {
            where.username = { $like: `%${params.keyword}%` };
        }

        // 查询用户列表（不返回密码字段）
        const result = await befly.db.getList<User>({
            table: 'user',
            fields: ['id', 'username', 'email', 'role', 'avatar', 'nickname', 'created_at', 'updated_at'],
            where,
            page: params.page || 1,
            limit: params.limit || 10,
            orderBy: ['created_at#DESC']
        });

        return Yes<GetUsersResponse>('查询成功', result);
    }
});
