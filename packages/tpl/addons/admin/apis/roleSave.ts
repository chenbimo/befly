/**
 * 保存用户的角色（单角色模式）
 */

import { Yes, No, Fields } from 'befly';

export default {
    name: '保存用户角色',
    fields: {
        adminId: Fields._id,
        roleId: Fields._id
    },
    handler: async (befly, ctx) => {
        try {
            // 查询角色是否存在
            const role = await befly.db.getOne({
                table: 'addon_admin_role',
                where: { id: ctx.body.roleId }
            });

            if (!role) {
                return No('角色不存在');
            }

            // 根据角色编码判断角色类型（硬编码规则）
            const roleType = role.code === 'dev' || role.code === 'admin' ? 'admin' : 'user';

            // 更新管理员的角色ID、角色编码和角色类型
            await befly.db.updData({
                table: 'addon_admin_admin',
                where: { id: ctx.body.adminId },
                data: {
                    roleId: ctx.body.roleId,
                    roleCode: role.code,
                    roleType: roleType
                }
            });

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('保存用户角色失败:', error);
            return No('操作失败');
        }
    }
};
