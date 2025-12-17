export default {
    name: "获取系统配置列表",
    fields: {
        page: "@page",
        limit: "@limit",
        keyword: "@keyword",
        state: "@state"
    },
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: "addon_admin_sys_config",
            fields: ["id", "name", "code", "value", "valueType", "group", "sort", "isSystem", "description", "state", "createdAt", "updatedAt"],
            page: ctx.body.page,
            limit: ctx.body.limit,
            orderBy: ["group#ASC", "sort#ASC", "id#ASC"]
        });

        return befly.tool.Yes("操作成功", result);
    }
};
