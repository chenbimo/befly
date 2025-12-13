/**
 * 获取用户信息接口
 *
 * @returns 返回 admin 表的字段（不含 password）以及关联的角色信息（小驼峰格式）:
 *  - id, name, email, phone, roleCode, state
 *  - lastLoginTime, lastLoginIp
 *  - createdAt, updatedAt
 *  - role: 角色完整信息（包含 menus 和 apis 权限）
 */

export default {
    name: '获取管理员信息',
    fields: {
        id: '@id'
    },
    handler: async (befly, ctx) => {
        const adminData = await befly.db.getOne({
            table: 'addon_admin_admin',
            fields: ['!password'],
            where: { id: ctx.user?.id }
        });

        if (!adminData?.id) {
            return befly.tool.No('管理员不存在');
        }

        return befly.tool.Yes('查询成功', adminData);
    }
};
