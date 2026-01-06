import adminRoleTable from "../../tables/role.json";
import { normalizePathnameListInput } from "../../utils/normalizePathnameListInput";

export default {
    name: "保存角色菜单权限",
    fields: {
        roleCode: adminRoleTable.code,
        menuPaths: adminRoleTable.menus
    },
    handler: async (befly, ctx) => {
        let menuPaths: string[] = [];
        try {
            menuPaths = normalizePathnameListInput(ctx.body.menuPaths, "menuPaths", false);
        } catch (error: any) {
            return befly.tool.No(`参数不合法：${error?.message || "未知错误"}`);
        }

        // 查询角色是否存在
        const role = await befly.db.getOne({
            table: "addon_admin_role",
            where: { code: ctx.body.roleCode }
        });

        if (!role.data?.id) {
            return befly.tool.No("角色不存在");
        }

        // 直接使用数组，数据库会自动处理存储
        await befly.db.updData({
            table: "addon_admin_role",
            where: { code: ctx.body.roleCode },
            data: {
                menus: menuPaths
            }
        });

        return befly.tool.Yes("操作成功");
    }
};
