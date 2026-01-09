import type { ApiRoute } from "befly/types/api";

import { fieldsScheme } from "../../utils/fieldsScheme";

const route: ApiRoute = {
    name: "获取菜单列表",
    fields: {
        page: fieldsScheme.page,
        limit: fieldsScheme.limit,
        keyword: fieldsScheme.keyword,
        state: fieldsScheme.state
    },
    handler: async (befly, _ctx) => {
        try {
            const menus = await befly.db.getAll({
                table: "addon_admin_menu"
            });

            return befly.tool.Yes("操作成功", { lists: menus.data.lists });
        } catch (error) {
            befly.logger.error({ err: error, msg: "获取菜单列表失败" });
            return befly.tool.No("操作失败");
        }
    }
};

export default route;
