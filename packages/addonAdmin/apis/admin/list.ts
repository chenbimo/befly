export default {
  name: "查询管理员列表",
  fields: {
    page: "@page",
    limit: "@limit",
    keyword: "@keyword",
    state: "@state",
  },
  handler: async (befly, ctx) => {
    const result = await befly.db.getList({
      table: "addon_admin_admin",
      page: ctx.body.page,
      limit: ctx.body.limit,
      where: {
        roleCode: {
          $ne: "dev",
        },
      },
      orderBy: ["createdAt#DESC"],
    });

    return befly.tool.Yes("获取成功", result);
  },
};
