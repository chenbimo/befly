import type { ApiRoute } from "befly/types/api";

const route: ApiRoute = {
    name: "获取所有系统配置",
    handler: async (befly) => {
        const result = await befly.db.getAll({
            table: "addon_admin_sys_config",
            orderBy: ["id#ASC"]
        });

        return befly.tool.Yes("操作成功", { lists: result.data.lists });
    }
};

export default route;
