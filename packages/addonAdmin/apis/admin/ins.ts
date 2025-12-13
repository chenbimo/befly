import adminTable from '../../tables/admin.json';

export default {
    name: '添加管理员',
    fields: {
        username: adminTable.username,
        password: adminTable.password,
        roleId: adminTable.roleId
    },
    required: ['username', 'password', 'roleId'],
    handler: async (befly, ctx) => {
        // 检查用户名是否已存在
        const existingByUsername = await befly.db.getOne({
            table: 'addon_admin_admin',
            where: { username: ctx.body.username }
        });

        if (existingByUsername) {
            return befly.tool.No('用户名已被使用');
        }

        // 查询角色信息
        const role = await befly.db.getOne({
            table: 'addon_admin_role',
            where: { id: ctx.body.roleId },
            columns: ['code']
        });

        if (!role?.code) {
            return befly.tool.No('角色不存在');
        }

        // 加密密码
        const hashedPassword = await befly.cipher.hashPassword(ctx.body.password);

        // 创建管理员
        const adminId = await befly.db.insData({
            table: 'addon_admin_admin',
            data: {
                username: ctx.body.username,
                password: hashedPassword,
                nickname: ctx.body.nickname,
                roleId: ctx.body.roleId,
                roleCode: role.code
            }
        });

        return befly.tool.Yes('添加成功', {
            id: adminId,
            username: ctx.body.username
        });
    }
};
