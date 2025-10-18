/**
 * 获取用户的角色（单角色模式）
 */

import { Yes, No, Fields } from 'befly';

export default {
    name: '获取用户角色',
    fields: {
        adminId: Fields._id
    },
    handler: async (befly, ctx) => {
        try {
            // 查询管理员信息（框架自动转换为小驼峰）
            const admin = await befly.db.getOne({
                table: 'addon_admin_admin',
                where: { id: ctx.body.adminId }
            });

            if (!admin) {
                return No('管理员不存在');
            }

            // 如果有角色ID，查询角色详细信息
            let roleInfo = null;
            if (admin.roleId) {
                roleInfo = await befly.db.getOne({
                    table: 'addon_admin_role',
                    where: { id: admin.roleId }
                });
            }

            return Yes('操作成功', {
                roleId: admin.roleId,
                roleCode: admin.roleCode,
                role: roleInfo
            });
        } catch (error) {
            befly.logger.error('获取用户角色失败:', error);
            return No('操作失败');
        }
    }
};
