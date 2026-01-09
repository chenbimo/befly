import type { ApiRoute } from "befly/types/api";

import { fieldsScheme } from "../../utils/fieldsScheme";

const route: ApiRoute = {
    name: "获取系统配置列表",
    fields: {
        page: fieldsScheme.page,
        limit: fieldsScheme.limit,
        keyword: fieldsScheme.keyword,
        state: fieldsScheme.state
    },
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: "addon_admin_sys_config",
            fields: ["id", "name", "code", "value", "valueType", "group", "sort", "isSystem", "description", "state", "createdAt", "updatedAt"],
            page: ctx.body.page,
            limit: ctx.body.limit,
            orderBy: ["group#ASC", "sort#ASC", "id#ASC"]
        });

        return befly.tool.Yes("操作成功", result.data);
    }
};

export default route;
