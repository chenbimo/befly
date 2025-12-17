export default {
    name: "获取配置状态",
    handler: async (befly) => {
        const status = {
            database: { status: "ok", latency: 0 },
            redis: { status: "ok", latency: 0 },
            fileSystem: { status: "ok" },
            email: { status: "warning", message: "未配置" },
            oss: { status: "warning", message: "未配置" }
        };

        // 检查数据库连接
        try {
            const startTime = Date.now();
            await befly.db.query("SELECT 1");
            status.database.latency = Date.now() - startTime;
            status.database.status = "ok";
        } catch {
            status.database.status = "error";
            status.database.message = "连接失败";
        }

        // 检查 Redis 连接
        try {
            const startTime = Date.now();
            await befly.redis.ping();
            status.redis.latency = Date.now() - startTime;
            status.redis.status = "ok";
        } catch {
            status.redis.status = "error";
            status.redis.message = "连接失败";
        }

        return befly.tool.Yes("获取成功", status);
    }
};
