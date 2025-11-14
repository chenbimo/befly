/**
 * 保存用户的角色（单角色模式）
 */

import { Yes, No } from 'befly';

export default {
    name: '角色保存',
    fields: {
        roleCode: {
            name: '角色编码',
            type: 'string',
            min: 2,
            max: 50,
            regexp: '^[a-zA-Z0-9_]+$'
        }
    },
    handler: async (befly, ctx) => {
        try {
            // 查询角色是否存在（使用 roleCode 而非 roleId）
            const role = await befly.db.getOne({
                table: 'addon_admin_role',
                where: { code: ctx.body.roleCode }
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
                    roleId: role.id,
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
