/**
 * 获取用户的角色（单角色模式）
 */

import { Yes, No, Fields } from 'befly';

export default {
    name: '获取用户角色',
    fields: {
        id: Fields._id
    },
    handler: async (befly, ctx) => {
        try {
            let roleInfo = null;
            if (ctx.body.id) {
                roleInfo = await befly.db.getOne({
                    table: 'addon_admin_role',
                    where: { code: ctx.body.id }
                });
            }

            return Yes('操作成功', {
                roleId: ctx.body.id,
                roleCode: ctx.body.id,
                role: roleInfo
            });
        } catch (error) {
            befly.logger.error('获取用户角色失败:', error);
            return No('操作失败');
        }
    }
};
