export default {
    name: "删除字典类型",
    fields: { "@id": true },
    required: ["id"],
    handler: async (befly, ctx) => {
        const { id } = ctx.body;

        const dictType = await befly.db.getOne<{ code?: string }>({
            table: "addon_admin_dict_type",
            where: { id: id }
        });

        if (!dictType.data?.code) {
            return befly.tool.No("字典类型不存在");
        }

        // 检查是否有字典项引用此类型
        const dictItems = await befly.db.getOne<{ id?: number }>({
            table: "addon_admin_dict",
            where: {
                typeCode: dictType.data.code
            }
        });

        if (dictItems.data?.id) {
            return befly.tool.No("该类型下存在字典项，无法删除");
        }

        await befly.db.delData({
            table: "addon_admin_dict_type",
            where: { id: id }
        });

        return befly.tool.Yes("删除成功");
    }
};
