import type { ApiRoute } from "befly/types/api";

import { fieldsScheme } from "../../utils/fieldsScheme";

const route: ApiRoute = {
    name: "获取角色列表",
    fields: {
        page: fieldsScheme.page,
        limit: fieldsScheme.limit,
        keyword: fieldsScheme.keyword,
        state: fieldsScheme.state
    },
    handler: async (befly, _ctx) => {
        const roles = await befly.db.getList({
            limit: 30,
            table: "addon_admin_role",
            where: {
                code: {
                    $ne: "dev"
                }
            },
            orderBy: ["sort#ASC", "id#ASC"]
        });

        return befly.tool.Yes("操作成功", roles.data);
    }
};

export default route;
