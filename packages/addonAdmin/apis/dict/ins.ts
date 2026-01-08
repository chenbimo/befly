import adminDictTable from "../../tables/dict.json";

export default {
    name: "添加字典",
    fields: adminDictTable,
    required: ["typeCode", "key", "label"],
    handler: async (befly, ctx) => {
        // 验证 typeCode 是否存在
        const dictType = await befly.db.getOne<{ id: number }>({
            table: "addon_admin_dict_type",
            where: { code: ctx.body.typeCode }
        });

        if (!dictType.data?.id) {
            return befly.tool.No("字典类型不存在");
        }

        // 检查 typeCode+key 是否已存在
        const existing = await befly.db.getOne<{ id: number }>({
            table: "addon_admin_dict",
            where: {
                typeCode: ctx.body.typeCode,
                key: ctx.body.key
            }
        });

        if (existing.data?.id) {
            return befly.tool.No("该类型下已存在相同的键名");
        }

        const dictId = await befly.db.insData({
            table: "addon_admin_dict",
            data: {
                typeCode: ctx.body.typeCode,
                key: ctx.body.key,
                label: ctx.body.label,
                sort: ctx.body.sort,
                remark: ctx.body.remark
            }
        });

        return befly.tool.Yes("添加成功", { id: dictId.data });
    }
};
