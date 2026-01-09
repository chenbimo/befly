import type { ApiRoute } from "befly/types/api";

export default {
    name: "获取字典项列表",
    fields: {
        typeCode: { type: "string", label: "类型代码", required: true }
    },
    required: ["typeCode"],
    handler: async (befly, ctx) => {
        // 验证 typeCode 是否存在
        const dictType = await befly.db.getOne<{ id?: number }>({
            table: "addon_admin_dict_type",
            where: { code: ctx.body.typeCode }
        });

        if (!dictType.data?.id) {
            return befly.tool.No("字典类型不存在");
        }

        // 获取该类型下的所有字典项
        const items = await befly.db.getAll({
            table: "addon_admin_dict",
            where: { typeCode: ctx.body.typeCode },
            orderBy: ["sort#ASC", "id#ASC"]
        });

        return befly.tool.Yes("获取成功", items.data);
    }
} as unknown as ApiRoute;
