export default {
    name: "获取接口列表",
    fields: {
        page: "@page",
        limit: "@limit",
        keyword: "@keyword",
        state: "@state"
    },
    handler: async (befly, ctx) => {
        try {
            const result = await befly.db.getList({
                table: "addon_admin_api",
                where: {
                    $or: ctx.body.keyword ? [{ name$like: `%${ctx.body.keyword}%` }, { routePath$like: `%${ctx.body.keyword}%` }] : undefined
                },
                orderBy: ["id#ASC"],
                page: ctx.body.page,
                limit: ctx.body.limit
            });

            return befly.tool.Yes("操作成功", result.data);
        } catch (error: any) {
            befly.logger.error({ err: error, msg: "获取接口列表失败" });
            return befly.tool.No("获取接口列表失败");
        }
    }
};
