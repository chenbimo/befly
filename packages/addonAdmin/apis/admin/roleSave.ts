/**
 * 保存管理员的角色（单角色模式）
 */

import { Yes, No } from '../../util.js';

export default {
    name: '保存管理员角色',
    fields: {
        adminId: '@id',
        roleCode: '角色编码|string|2|50|null|1|^[a-zA-Z0-9_]+$'
    },
    handler: async (befly, ctx) => {
        // 查询角色是否存在（使用 roleCode 而非 roleId）
        const role = await befly.db.getOne({
            table: 'core_role',
            where: { code: ctx.body.roleCode }
        });

        if (!role) {
            return No('角色不存在');
        }

        // 根据角色编码判断角色类型（硬编码规则）
        const roleType = role.code === 'dev' || role.code === 'admin' ? 'admin' : 'user';

        // 更新管理员的角色ID、角色编码和角色类型
        await befly.db.updData({
            table: 'core_admin',
            where: { id: ctx.body.adminId },
            data: {
                roleId: role.id,
                roleCode: role.code,
                roleType: roleType
            }
        });

        return Yes('操作成功');
    }
};
