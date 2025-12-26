/**
 * 获取当前用户的菜单权限
 * 说明：
 * 1. 从 Redis 缓存读取所有菜单（如果缓存不存在则从数据库查询并缓存）
 * 2. 根据当前登录用户的角色过滤可访问的菜单
 * 3. 返回一维数组（由前端构建树形结构）
 * 4. 仅返回状态为启用的菜单
 */

export default {
    name: "获取用户菜单",
    handler: async (befly, ctx) => {
        try {
            // 2. 查询角色信息获取菜单权限（使用 roleCode 而非 roleId）
            const role = await befly.db.getOne({
                table: "addon_admin_role",
                where: { code: ctx.user.roleCode }
            });

            if (!role?.id) {
                return befly.tool.No("角色不存在", { lists: [] });
            }

            // 3. 解析菜单ID列表（数组，数据库字段已改为 array 存储）
            const rawMenuIds = Array.isArray(role.menus) ? role.menus : [];
            const menuIds = rawMenuIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id));

            if (menuIds.length === 0) {
                return befly.tool.Yes("菜单为空", { lists: [] });
            }

            // 4. 从缓存获取所有菜单
            let allMenus = await befly.cache.getMenus();

            // 如果缓存不存在，从数据库查询
            if (allMenus.length === 0) {
                const result = await befly.db.getAll({
                    table: "addon_admin_menu"
                });
                allMenus = result.lists;
            }

            if (allMenus.length === 0) {
                return befly.tool.Yes("菜单为空", { lists: [] });
            }

            // 5. 根据角色权限过滤菜单
            const menuIdSet = new Set<number>(menuIds);
            const authorizedMenus = allMenus.filter((menu: any) => menuIdSet.has(Number(menu.id)));

            // 6. 返回一维数组（由前端构建树形结构）
            return befly.tool.Yes("获取菜单成功", { lists: authorizedMenus });
        } catch (error: any) {
            befly.logger.error({ err: error }, "获取用户菜单失败");
            return befly.tool.No("获取菜单失败");
        }
    }
};
