/**
 * 获取当前用户的菜单权限
 * 说明：
 * 1. 从 Redis 缓存读取所有菜单（如果缓存不存在则从数据库查询并缓存）
 * 2. 根据当前登录用户的角色过滤可访问的菜单
 * 3. 返回一维数组（由前端构建树形结构）
 * 4. 仅返回状态为启用的菜单
 */

import type { DbJsonRow } from "../../utils/dbJsonRow";
import type { ApiRoute } from "befly/types/api";

const route: ApiRoute = {
    name: "获取用户菜单",
    handler: async (befly, ctx) => {
        try {
            // 2. 查询角色信息获取菜单权限（使用 roleCode 而非 roleId）
            const role = await befly.db.getOne<{ id?: number; menus?: unknown }>({
                table: "addon_admin_role",
                where: { code: ctx.user["roleCode"] }
            });

            if (!role.data?.id) {
                return befly.tool.No("角色不存在", { lists: [] });
            }

            // 3. 解析菜单路径列表（menu.path 数组，array_text）
            const rawMenuPaths = Array.isArray(role.data.menus) ? role.data.menus : [];
            const menuPaths = rawMenuPaths.map((p: unknown) => (typeof p === "string" ? p.trim() : "")).filter((p: string) => p.length > 0);

            if (menuPaths.length === 0) {
                return befly.tool.Yes("菜单为空", { lists: [] });
            }

            // 4. 从缓存获取所有菜单
            let allMenus: unknown[] = await befly.cache.getMenus();

            // 如果缓存不存在，从数据库查询
            if (allMenus.length === 0) {
                const result = await befly.db.getAll<DbJsonRow>({
                    table: "addon_admin_menu"
                });
                allMenus = result.data.lists;
            }

            if (allMenus.length === 0) {
                return befly.tool.Yes("菜单为空", { lists: [] });
            }

            // 5. 根据角色权限过滤菜单（按 menu.path）
            const menuPathSet = new Set<string>(menuPaths);
            const authorizedMenus = allMenus
                .filter((menu): menu is Record<string, unknown> => typeof menu === "object" && menu !== null)
                .filter((menu) => {
                    const path = menu["path"];
                    return typeof path === "string" && menuPathSet.has(path);
                })
                .map((menu) => menu as DbJsonRow);

            // 6. 返回一维数组（由前端构建树形结构）
            return befly.tool.Yes("获取菜单成功", { lists: authorizedMenus });
        } catch (error: unknown) {
            befly.logger.error({ err: error, msg: "获取用户菜单失败" });
            return befly.tool.No("获取菜单失败");
        }
    }
};

export default route;
