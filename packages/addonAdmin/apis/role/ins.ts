import type { ApiRoute } from "befly/types/api";

import adminRoleTable from "../../tables/role.json";
import { normalizePathnameListInput } from "../../utils/normalizePathnameListInput";

const route: ApiRoute = {
    name: "创建角色",
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

        // 检查角色代码是否已存在
        const existing = await befly.db.getOne({
            table: "addon_admin_role",
            where: { code: ctx.body.code }
        });

        if (existing.data?.id) {
            return befly.tool.No("角色代码已存在");
        }

        const roleId = await befly.db.insData({
            table: "addon_admin_role",
            data: {
                name: ctx.body.name,
                code: ctx.body.code,
                description: ctx.body.description,
                menus: menuPaths,
                apis: apiPaths,
                sort: ctx.body.sort
                // state 由框架自动设置为 1
            }
        });

        // 增量刷新角色权限缓存
        await befly.cache.refreshRoleApiPermissions(ctx.body.code, apiPaths);

        return befly.tool.Yes("操作成功", { id: roleId.data });
    }
};

export default route;
