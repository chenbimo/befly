import type { ApiRoute } from "befly/types/api";

import { fieldsScheme } from "../../utils/fieldsScheme";

const route: ApiRoute = {
    name: "获取操作日志列表",
    fields: {
        page: fieldsScheme.page,
        limit: fieldsScheme.limit,
        keyword: fieldsScheme.keyword,
        state: fieldsScheme.state
    },
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: "addon_admin_operate_log",
            page: ctx.body.page,
            limit: ctx.body.limit,
            orderBy: ["operateTime#DESC"]
        });

        return befly.tool.Yes("获取成功", result.data);
    }
};

export default route;
