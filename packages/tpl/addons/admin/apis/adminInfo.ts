/**
 * 获取用户信息接口
 *
 * @returns 返回 admin 表的字段（不含 password）以及关联的角色信息（小驼峰格式）:
 *  - id, name, email, phone, roleId, roleCode, state
 *  - lastLoginTime, lastLoginIp
 *  - createdAt, updatedAt
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

        // 查询用户信息（框架自动转换为小驼峰）
        const admin = await befly.db.getOne({
            table: 'addon_admin_admin',
            where: { id: userId }
        });

        if (!admin) {
            return No('用户不存在');
        }

        // 查询角色信息（包含权限，框架自动转换为小驼峰）
        let roleInfo = null;
        if (admin.roleId) {
            roleInfo = await befly.db.getOne({
                table: 'addon_admin_role',
                where: { id: admin.roleId }
            });
        }

        // 返回用户信息（不包含密码，字段已是小驼峰格式）
        const { password: _, ...userWithoutPassword } = admin;

        return Yes('获取成功', {
            ...userWithoutPassword,
            role: roleInfo
        });
    }
};
