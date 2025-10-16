/**
 * 获取用户的角色
 */

import { Yes, No } from 'befly';
export default {
    name: '获取用户角色',
    method: 'POST',
    auth: true,
    fields: {
        adminId: '用户ID|number|1|999999999999999|null|1|null'
    },
    handler: async (befly, ctx) => {
        try {
            const roleRecords = await befly.db.getAll({
                table: 'addon_admin_admin_role',
                fields: ['role_id'],
                where: { admin_id: ctx.body.adminId }
            });

            const ids = roleRecords.map((item: any) => item.role_id);

            return Yes('操作成功', ids);
        } catch (error) {
            befly.logger.error('获取用户角色失败:', error);
            return No('操作失败');
        }
    }
};
