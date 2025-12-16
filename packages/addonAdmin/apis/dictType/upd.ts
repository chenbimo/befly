import dictTypeTable from "../../tables/dictType.json";

export default {
  name: "更新字典类型",
  fields: {
    ...dictTypeTable,
    "@id": true,
  },
  required: ["id"],
  handler: async (befly, ctx) => {
    const { id, code, name, description, sort } = ctx.body;

    // 如果更新了 code，需要检查是否已被使用
    if (code) {
      const existing = await befly.db.getOne({
        table: "addon_admin_dict_type",
        where: {
          code: code,
          id$ne: id,
        },
      });

      if (existing?.id) {
        return befly.tool.No("类型代码已被使用");
      }
    }

    const updateData: Record<string, any> = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (sort !== undefined) updateData.sort = sort;

    await befly.db.updData({
      table: "addon_admin_dict_type",
      data: updateData,
      where: { id: id },
    });

    return befly.tool.Yes("更新成功");
  },
};
