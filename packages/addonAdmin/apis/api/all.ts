export default {
    name: "获取所有接口",
    handler: async (befly) => {
        try {
            // 从缓存获取所有接口
            let allApis = await befly.cache.getApis();

            // 如果缓存不存在，从数据库查询并缓存
            if (allApis.length === 0) {
                const result = await befly.db.getAll({
                    table: "addon_admin_api",
                    orderBy: ["id#ASC"]
                });
                allApis = result.data.lists;

                // 缓存到 Redis
                if (allApis.length > 0) {
                    await befly.cache.cacheApis();
                }
            }

            return befly.tool.Yes("操作成功", { lists: allApis });
        } catch (error: any) {
            befly.logger.error({ err: error, msg: "获取接口列表失败" });
            return befly.tool.No("获取接口列表失败");
        }
    }
};
