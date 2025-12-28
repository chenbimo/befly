import adminRoleTable from "../../tables/role.json";

export default {
    name: "获取角色接口权限",
    fields: {
        roleCode: adminRoleTable.code
    },
    handler: async (befly, ctx) => {
        // 查询角色信息
        const role = await befly.db.getOne({
            table: "addon_admin_role",
            where: { code: ctx.body.roleCode }
        });

        if (!role.data?.id) {
            return befly.tool.No("角色不存在");
        }

        // 数据库自动将 array_text 转换为数组
        const apiPaths = Array.isArray(role.data.apis) ? role.data.apis : [];

        return befly.tool.Yes("操作成功", { apiPaths: apiPaths });
    }
};
