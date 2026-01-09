import type { ApiRoute } from "befly/types/api";

import { fieldsScheme } from "../../utils/fieldsScheme";

const route: ApiRoute = {
    name: "查询管理员列表",
    fields: {
        page: fieldsScheme.page,
        limit: fieldsScheme.limit,
        keyword: fieldsScheme.keyword,
        state: fieldsScheme.state
    },
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: "addon_admin_admin",
            page: ctx.body.page,
            limit: ctx.body.limit,
            where: {
                roleCode: {
                    $ne: "dev"
                }
            },
            orderBy: ["createdAt#DESC"]
        });

        return befly.tool.Yes("获取成功", result.data);
    }
};

export default route;
