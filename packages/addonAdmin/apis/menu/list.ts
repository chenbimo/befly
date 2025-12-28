export default {
    name: "获取菜单列表",
    fields: {
        page: "@page",
        limit: "@limit",
        keyword: "@keyword",
        state: "@state"
    },
    handler: async (befly) => {
        try {
            const menus = await befly.db.getAll({
                table: "addon_admin_menu"
            });

            return befly.tool.Yes("操作成功", { lists: menus.data.lists });
        } catch (error) {
            befly.logger.error({ err: error }, "获取菜单列表失败");
            return befly.tool.No("操作失败");
        }
    }
};
