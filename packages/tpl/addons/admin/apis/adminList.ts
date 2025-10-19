/**
 * 获取管理员列表
 */

import { Yes, No } from 'befly';

export default {
    name: '获取管理员列表',
    handler: async (befly, ctx) => {
        // 查询所有管理员（不包含密码字段）
        const adminList = await befly.db.getAll({
            table: 'addon_admin_admin',
            fields: ['id', 'name', 'nickname', 'email', 'phone', 'username', 'avatar', 'roleId', 'roleCode', 'roleType', 'lastLoginTime', 'lastLoginIp', 'state', 'created_at', 'updated_at'],
            orderBy: ['created_at#DESC']
        });

        return Yes('获取成功', adminList);
    }
};
