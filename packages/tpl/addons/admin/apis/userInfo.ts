/**
 * 获取用户信息接口
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { Admin } from '../types';

export default Api('获取用户信息', {
    method: 'GET',
    auth: true, // 需要认证
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        // 从 JWT token 中获取用户ID
        const userId = ctx.auth?.userId;

        if (!userId) {
            return No('未授权');
        }

        // 查询用户信息
        const admin = await befly.db.getDetail<Admin>({
            table: 'admin_admin',
            where: { id: parseInt(userId) }
        });

        if (!admin) {
            return No('用户不存在');
        }

        // 返回用户信息（不包含密码）
        const { password: _, ...userWithoutPassword } = admin;

        return Yes('获取成功', userWithoutPassword);
    }
});
