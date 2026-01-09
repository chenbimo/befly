import type { ApiRoute } from "befly/types/api";

import adminRoleTable from "../../tables/role.json";
import { normalizePathnameListInput } from "../../utils/normalizePathnameListInput";

const route: ApiRoute = {
    name: "保存角色接口权限",
    fields: {
        roleCode: adminRoleTable.code,
        apiPaths: adminRoleTable.apis
    },
    handler: async (befly, ctx) => {
        let apiPaths: string[] = [];
        try {
            apiPaths = normalizePathnameListInput(ctx.body.apiPaths, "apiPaths", true);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "未知错误";
            return befly.tool.No(`参数不合法：${msg}`);
        }

        // 查询角色是否存在
        const role = await befly.db.getOne<{ id?: number; code?: string }>({
            table: "addon_admin_role",
            where: { code: ctx.body.roleCode }
        });

        if (!role.data?.id) {
            return befly.tool.No("角色不存在");
        }

        const roleCode = role.data.code;
        if (typeof roleCode !== "string" || roleCode.length === 0) {
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
        await befly.cache.refreshRoleApiPermissions(roleCode, apiPaths);

        return befly.tool.Yes("操作成功");
    }
};

export default route;
