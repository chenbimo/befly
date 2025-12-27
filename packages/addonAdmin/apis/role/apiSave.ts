import { normalizePathnameListInput } from "befly-shared/utils/normalizePathnameListInput";

import adminRoleTable from "../../tables/role.json";

export default {
    name: "保存角色接口权限",
    fields: {
        roleCode: adminRoleTable.code,
        apiPaths: adminRoleTable.apis
    },
    handler: async (befly, ctx) => {
        let apiPaths: string[] = [];
        try {
            apiPaths = normalizePathnameListInput(ctx.body.apiPaths, "apiPaths", true);
        } catch (error: any) {
            return befly.tool.No(`参数不合法：${error?.message || "未知错误"}`);
        }

        // 查询角色是否存在
        const role = await befly.db.getOne({
            table: "addon_admin_role",
            where: { code: ctx.body.roleCode }
        });

        if (!role?.id) {
            return befly.tool.No("角色不存在");
        }

        // 直接使用数组，数据库会自动处理存储
        await befly.db.updData({
            table: "addon_admin_role",
            where: { code: ctx.body.roleCode },
            data: {
                apis: apiPaths
            }
        });

        // 增量刷新 Redis 权限缓存
        await befly.cache.refreshRoleApiPermissions(role.code, apiPaths);

        return befly.tool.Yes("操作成功");
    }
};
