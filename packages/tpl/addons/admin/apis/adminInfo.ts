/**
 * 获取用户信息接口
 *
 * @returns 返回 admin 表的字段（不含 password）以及关联的角色信息:
 *  - id, name, email, phone, roleId, status
 *  - last_login_time, last_login_ip
 *  - created_at, updated_at
 *  - role: 角色完整信息（包含 menus 和 apis 权限）
 */

import { Yes, No } from 'befly';

export default {
    name: '获取用户信息',
    handler: async (befly, ctx) => {
        // 从 JWT token 中获取用户ID
        const userId = ctx.user?.id;

        if (!userId) {
            return No('未授权');
        }

        // 查询用户信息
        const admin = await befly.db.getDetail({
            table: 'addon_admin_admin',
            where: { id: userId }
        });

        if (!admin) {
            return No('用户不存在');
        }

        // 查询角色信息（包含权限）
        let roleInfo = null;
        if (admin.roleId) {
            roleInfo = await befly.db.getDetail({
                table: 'addon_admin_role',
                where: { id: admin.roleId }
            });
        }

        // 返回用户信息（不包含密码）
        const { password: _, ...userWithoutPassword } = admin;

        return Yes('获取成功', {
            ...userWithoutPassword,
            role: roleInfo
        });
    }
};
