import type { ApiRoute } from "befly/types/api";

import roleTable from "../../tables/role.json";

const route: ApiRoute = {
    name: "获取用户角色",
    fields: {
        id: roleTable.code
    },
    handler: async (befly, ctx) => {
        let roleInfo = null;
        if (ctx.body.id && ctx.user.roleType === "admin") {
            const roleInfoResult = await befly.db.getOne({
                table: "addon_admin_role",
                where: { code: ctx.body.id }
            });

            const roleId = (roleInfoResult.data as { id?: number }).id;
            if (typeof roleId === "number") {
                roleInfo = roleInfoResult.data;
            }
        }

        return befly.tool.Yes("操作成功", {
            roleCode: ctx.body.id,
            role: roleInfo
        });
    }
};

export default route;
