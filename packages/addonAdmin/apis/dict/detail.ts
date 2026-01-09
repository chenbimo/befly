import type { ApiRoute } from "befly/types/api";

import { fieldsScheme } from "../../utils/fieldsScheme";

const route: ApiRoute = {
    name: "获取字典详情",
    fields: { id: fieldsScheme.id },
    required: ["id"],
    handler: async (befly, ctx) => {
        const dict = await befly.db.getOne({
            table: "addon_admin_dict",
            joins: [
                //
                {
                    table: "addon_admin_dict_type",
                    on: "addon_admin_dict.type_code = addon_admin_dict_type.code"
                }
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
                "addon_admin_dict_type.name AS typeName"
            ],
            where: { "addon_admin_dict.id": ctx.body.id }
        });

        if (!dict.data?.id) {
            return befly.tool.No("字典项不存在");
        }

        return befly.tool.Yes("获取成功", dict.data);
    }
};

export default route;
