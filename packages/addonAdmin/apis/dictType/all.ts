import type { DbJsonRow } from "../../utils/dbJsonRow";
import type { ApiRoute } from "befly/types/api";

const route: ApiRoute = {
    name: "获取所有字典类型",
    handler: async (befly) => {
        const result = await befly.db.getAll<DbJsonRow>({
            table: "addon_admin_dict_type",
            orderBy: ["sort#ASC", "id#ASC"]
        });

        return befly.tool.Yes("操作成功", { lists: result.data.lists });
    }
};

export default route;
