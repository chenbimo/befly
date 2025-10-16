/**
 * 保存用户的角色
 */

import { Yes, No } from 'befly';
export default {
    name: '保存用户角色',
    method: 'POST',
    auth: true,
    fields: {
        adminId: '用户ID|number|1|999999999999999|null|1|null',
        roleIds: '角色ID列表|string|0|10000|[]|0|null'
    },
    handler: async (befly, ctx) => {
        try {
            // 解析角色 ID 数组
            let roleIdArray: number[] = [];
            try {
                roleIdArray = typeof ctx.body.roleIds === 'string' ? JSON.parse(ctx.body.roleIds) : ctx.body.roleIds;
            } catch {
                roleIdArray = [];
            }

            // 先删除该用户的所有角色（软删除）
            await befly.db.delData({
                table: 'addon_admin_admin_role',
                where: { admin_id: ctx.body.adminId }
            });

            // 批量插入新的角色
            if (roleIdArray.length > 0) {
                for (const roleId of roleIdArray) {
                    await befly.db.insData({
                        table: 'addon_admin_admin_role',
                        data: {
                            admin_id: ctx.body.adminId,
                            role_id: roleId
                        }
                    });
                }
            }

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('保存用户角色失败:', error);
            return No('操作失败');
        }
    }
};
