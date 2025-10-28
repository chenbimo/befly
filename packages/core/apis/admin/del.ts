/**
 * 删除管理员
 */

import { Yes, No } from '../../util.js';

export default {
    name: '删除管理员',
    fields: {},
    required: ['id'],
    handler: async (befly, ctx) => {
        // 检查管理员是否存在
        const admin = await befly.db.getOne({
            table: 'addon_admin_admin',
            where: { id: ctx.body.id }
        });

        if (!admin) {
            return No('管理员不存在');
        }

        // 不能删除 dev 角色的管理员
        if (admin.roleCode === 'dev') {
            return No('不能删除开发者账号');
        }

        // 删除管理员
        await befly.db.delData({
            table: 'addon_admin_admin',
            where: { id: ctx.body.id }
        });

        return Yes('删除成功');
    }
};
