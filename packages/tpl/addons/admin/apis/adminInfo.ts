/**
 * 获取用户信息接口
 *
 * @returns 返回 admin 表的字段（不含 password）:
 *  - id, name, email, phone, role, status
 *  - last_login_time, last_login_ip
 *  - created_at, updated_at
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
            table: 'addon_admin_admin',
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
