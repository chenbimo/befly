import type { ApiRoute } from "befly/types/api";

import { fieldsScheme } from "../../utils/fieldsScheme";

const route: ApiRoute = {
    name: "获取管理员信息",
    fields: {
        id: fieldsScheme.id
    },
    handler: async (befly, ctx) => {
        const adminData = await befly.db.getOne({
            table: "addon_admin_admin",
            fields: ["!password"],
            where: { id: ctx.user?.id }
        });

        if (!adminData.data?.id) {
            return befly.tool.No("管理员不存在");
        }

        return befly.tool.Yes("查询成功", adminData.data);
    }
};

export default route;
