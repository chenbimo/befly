export default {
  name: "删除角色",
  fields: {
    id: "@id",
  },
  handler: async (befly, ctx) => {
    try {
      // 检查是否有用户使用此角色（使用 getList 代替 getAll）
      const role = await befly.db.getOne({
        table: "addon_admin_role",
        where: { id: ctx.body.id },
        fields: ["code"],
      });

      if (!role?.code) {
        return befly.tool.No("角色不存在");
      }

      // 禁止删除系统角色
      const systemRoles = ["dev", "user", "admin", "guest"];
      if (systemRoles.includes(role.code)) {
        return befly.tool.No(`系统角色 [${role.code}] 不允许删除`);
      }

      const adminList = await befly.db.getList({
        table: "addon_admin_admin",
        where: { roleCode: role.code },
      });

      if (adminList.total > 0) {
        return befly.tool.No("该角色已分配给用户，无法删除");
      }

      // 删除角色
      await befly.db.delData({
        table: "addon_admin_role",
        where: { id: ctx.body.id },
      });

      // 删除角色权限缓存
      await befly.cache.deleteRolePermissions(role.code);

      return befly.tool.Yes("操作成功");
    } catch (error: any) {
      befly.logger.error({ err: error }, "删除角色失败");
      return befly.tool.No("操作失败");
    }
  },
};
