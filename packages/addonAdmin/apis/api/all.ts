import type { DbJsonRow } from "../../utils/dbJsonRow";
import type { ApiRoute } from "befly/types/api";

const route: ApiRoute = {
    name: "获取所有接口",
    handler: async (befly) => {
        try {
            // 从缓存获取所有接口
            let allApis: unknown[] = await befly.cache.getApis();

            // 如果缓存不存在，从数据库查询并缓存
            if (allApis.length === 0) {
                const result = await befly.db.getAll<DbJsonRow>({
                    table: "addon_admin_api",
                    orderBy: ["id#ASC"]
                });
                allApis = result.data.lists;

                // 缓存到 Redis
                if (allApis.length > 0) {
                    await befly.cache.cacheApis();
                }
            }

            const lists = allApis.filter((api): api is Record<string, unknown> => typeof api === "object" && api !== null).map((api) => api as DbJsonRow);

            return befly.tool.Yes("操作成功", { lists: lists });
        } catch (error: unknown) {
            befly.logger.error({ err: error, msg: "获取接口列表失败" });
            return befly.tool.No("获取接口列表失败");
        }
    }
};

export default route;
