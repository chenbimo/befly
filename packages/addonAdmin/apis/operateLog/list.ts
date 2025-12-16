export default {
  name: "获取操作日志列表",
  fields: {
    page: "@page",
    limit: "@limit",
    keyword: "@keyword",
    state: "@state",
  },
  handler: async (befly, ctx) => {
    const result = await befly.db.getList({
      table: "addon_admin_operate_log",
      page: ctx.body.page,
      limit: ctx.body.limit,
      orderBy: ["operateTime#DESC"],
    });

    return befly.tool.Yes("获取成功", result);
  },
};
