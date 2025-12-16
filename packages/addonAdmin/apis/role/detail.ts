export default {
  name: "获取用户角色",
  fields: {
    id: "@id",
  },
  handler: async (befly, ctx) => {
    let roleInfo = null;
    if (ctx.body.id && ctx.user.roleType === "admin") {
      roleInfo = await befly.db.getOne({
        table: "addon_admin_role",
        where: { code: ctx.body.id },
      });
    }

    return befly.tool.Yes("操作成功", {
      roleCode: ctx.body.id,
      role: roleInfo,
    });
  },
};
