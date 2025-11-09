/**
 * 获取管理员的角色（单角色模式）
 */

import { Yes, No } from 'befly';

export default {
    name: '获取管理员角色',
    handler: async (befly, ctx) => {
        // 查询管理员信息（框架自动转换为小驼峰）
        const admin = await befly.db.getOne({
            table: 'addon_admin_admin',
            where: { id: ctx.body.adminId }
        });

        if (!admin) {
            return No('管理员不存在');
        }

        // 如果有角色编码，查询角色详细信息（使用 roleCode 而非 roleId）
        let roleInfo = null;
        if (admin.roleCode) {
            roleInfo = await befly.db.getOne({
                table: 'addon_admin_role',
                where: { code: admin.roleCode }
            });
        }

        return Yes('操作成功', {
            roleId: admin.roleId,
            roleCode: admin.roleCode,
            role: roleInfo
        });
    }
};
