import type { ApiRoute } from "befly/types/api";

const route: ApiRoute = {
    name: "获取权限统计",
    handler: async (befly) => {
        // 统计菜单数量
        const menuCount = await befly.db.count({
            table: "addon_admin_menu"
        });

        // 统计接口数量
        const apiCount = await befly.db.count({
            table: "addon_admin_api"
        });

        // 统计角色数量
        const roleCount = await befly.db.count({
            table: "addon_admin_role"
        });

        return befly.tool.Yes("获取成功", {
            menuCount: menuCount.data,
            apiCount: apiCount.data,
            roleCount: roleCount.data
        });
    }
};

export default route;
