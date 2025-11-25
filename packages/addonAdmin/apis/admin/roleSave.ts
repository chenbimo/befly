export default {
    name: '管理员角色保存',
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
        // 查询角色是否存在（使用 roleCode 而非 roleId）
        const role = await befly.db.getOne({
            table: 'addon_admin_role',
            where: { code: ctx.body.roleCode }
        });

        if (!role) {
            return befly.tool.No('角色不存在');
        }

        // 根据角色编码判断角色类型（硬编码规则）
        const roleType = role.code === 'dev' || role.code === 'admin' ? 'admin' : 'user';

        // 更新管理员的角色ID、角色编码和角色类型
        await befly.db.updData({
            table: 'addon_admin_admin',
            where: { id: ctx.body.id },
            data: {
                roleId: role.id,
                roleCode: role.code,
                roleType: roleType
            }
        });

        return befly.tool.Yes('操作成功');
    }
};
