export default {
    name: "获取登录日志列表",
    fields: {
        page: "@page",
        limit: "@limit",
        keyword: "@keyword",
        state: "@state"
    },
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: "addon_admin_login_log",
            page: ctx.body.page,
            limit: ctx.body.limit,
            orderBy: ["loginTime#DESC"]
        });

        return befly.tool.Yes("获取成功", result);
    }
};
