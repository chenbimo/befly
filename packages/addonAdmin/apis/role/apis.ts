import adminRoleTable from '../../tables/role.json';

export default {
    name: '获取角色接口权限',
    fields: {
        roleCode: adminRoleTable.code
    },
    handler: async (befly, ctx) => {
        // 查询角色信息
        const role = await befly.db.getOne({
            table: 'addon_admin_role',
            where: { code: ctx.body.roleCode }
        });

        if (!role) {
            return befly.tool.No('角色不存在');
        }

        // 解析接口ID列表（逗号分隔的字符串转为数组）
        const apiIds = role.apis
            ? role.apis
                  .split(',')
                  .map((id: string) => parseInt(id.trim()))
                  .filter((id: number) => !isNaN(id))
            : [];

        return befly.tool.Yes('操作成功', { apiIds });
    }
};
