import type { ApiRoute } from "befly/types/api";

import { fieldsScheme } from "../../utils/fieldsScheme";

const route: ApiRoute = {
    name: "字典类型详情",
    fields: { id: fieldsScheme.id },
    required: ["id"],
    handler: async (befly, ctx) => {
        const detail = await befly.db.getOne({
            table: "addon_admin_dict_type",
            where: { id: ctx.body.id }
        });

        if (!detail.data?.id) {
            return befly.tool.No("字典类型不存在");
        }

        return befly.tool.Yes("获取成功", detail.data);
    }
};

export default route;
