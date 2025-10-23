/**
 * 获取用户的角色（单角色模式）
 */

import { Yes, No, Fields } from 'befly';

export default {
    name: '获取用户角色',
    auth: true, // 需要登录（权限由角色接口列表控制）
    fields: {
        id: Fields._id
    },
    handler: async (befly, ctx) => {
        let roleInfo = null;
        if (ctx.body.id && ctx.user.roleType === 'admin') {
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
    }
};
