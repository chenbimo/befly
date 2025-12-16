export default {
  name: "获取所有字典",
  handler: async (befly) => {
    const result = await befly.db.getAll({
      table: "addon_admin_dict",
      joins: [
        {
          table: "addon_admin_dict_type",
          on: "addon_admin_dict.type_code = addon_admin_dict_type.code",
        },
      ],
      fields: [
        //
        "addon_admin_dict.id",
        "addon_admin_dict.typeCode",
        "addon_admin_dict.key",
        "addon_admin_dict.label",
        "addon_admin_dict.sort",
        "addon_admin_dict.remark",
        "addon_admin_dict.createdAt",
        "addon_admin_dict.updatedAt",
        "addon_admin_dict_type.name AS typeName",
      ],
      orderBy: ["addon_admin_dict.sort#ASC", "addon_admin_dict.id#ASC"],
    });

    return befly.tool.Yes("获取成功", result);
  },
};
