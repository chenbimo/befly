import type { DbJsonRow } from "../../utils/dbJsonRow";
import type { ApiRoute } from "befly/types/api";

const route: ApiRoute = {
    name: "获取所有角色",
    handler: async (befly) => {
        const roles = await befly.db.getAll<DbJsonRow>({
            table: "addon_admin_role",
            where: {
                code: {
                    $ne: "dev"
                }
            },
            orderBy: ["sort#ASC", "id#ASC"]
        });

        return befly.tool.Yes("操作成功", { lists: roles.data.lists, total: roles.data.total });
    }
};

export default route;
