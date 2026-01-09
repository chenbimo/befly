import type { ApiRoute } from "befly/types/api";

import { fieldsScheme } from "../../utils/fieldsScheme";

const route: ApiRoute = {
    name: "删除字典",
    fields: { id: fieldsScheme.id },
    required: ["id"],
    handler: async (befly, ctx) => {
        await befly.db.delData({
            table: "addon_admin_dict",
            where: { id: ctx.body.id }
        });

        return befly.tool.Yes("删除成功");
    }
};

export default route;
