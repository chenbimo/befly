import type { ApiRoute } from "befly/types/api";

import adminRoleTable from "../../tables/role.json";
import { normalizePathnameListInput } from "../../utils/normalizePathnameListInput";

const route: ApiRoute = {
    name: "更新角色",
    fields: adminRoleTable,
    handler: async (befly, ctx) => {
        let apiPaths: string[] = [];
        let menuPaths: string[] = [];

        try {
            apiPaths = normalizePathnameListInput(ctx.body.apis, "apis", true);

            menuPaths = normalizePathnameListInput(ctx.body.menus, "menus", false);
        } catch (error: any) {
            return befly.tool.No(`参数不合法：${error?.message || "未知错误"}`);
        }

        // 检查角色代码是否被其他角色占用
        const existing = await befly.db.getList({
            table: "addon_admin_role",
            where: {
                code: ctx.body.code,
                id$ne: ctx.body.id
            }
        });

        if (existing.data.total > 0) {
            return befly.tool.No("角色代码已被其他角色使用");
        }

        await befly.db.updData({
            table: "addon_admin_role",
            where: { id: ctx.body.id },
            data: {
                name: ctx.body.name,
                code: ctx.body.code,
                description: ctx.body.description,
                menus: menuPaths,
                apis: apiPaths,
                sort: ctx.body.sort
                // state 字段不在此处更新，需要禁用/启用时单独处理
            }
        });

        // 增量刷新角色权限缓存
        await befly.cache.refreshRoleApiPermissions(ctx.body.code, apiPaths);

        return befly.tool.Yes("操作成功");
    }
};

export default route;
