import { Api } from 'befly';

/**
 * 保存用户的角色
 */
export default Api('保存用户角色', {
    method: 'POST',
    auth: true,
    fields: {
        adminId: '用户ID|number|1|999999999999999|null|1|null',
        roleIds: '角色ID列表|string|0|10000|[]|0|null'
    },
    handler: async (befly, ctx) => {
        try {
            const { adminId, roleIds } = ctx.body;

            // 解析角色 ID 数组
            let roleIdArray: number[] = [];
            try {
                roleIdArray = typeof roleIds === 'string' ? JSON.parse(roleIds) : roleIds;
            } catch {
                roleIdArray = [];
            }

            // 先删除该用户的所有角色
            await befly.db.query('UPDATE admin_admin_role SET deleted_at = ? WHERE admin_id = ?', [Date.now(), adminId]);

            // 批量插入新的角色
            if (roleIdArray.length > 0) {
                for (const roleId of roleIdArray) {
                    await befly.db.insData({
                        table: 'admin_admin_role',
                        data: {
                            admin_id: adminId,
                            role_id: roleId
                        }
                    });
                }
            }

            return befly.code.success;
        } catch (error) {
            befly.logger.error('保存用户角色失败:', error);
            return befly.code.fail;
        }
    }
});
