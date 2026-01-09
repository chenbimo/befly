import type { ApiRoute } from "befly/types/api";

import os from "node:os";

const route: ApiRoute = {
    name: "获取运行环境信息",
    handler: async (befly) => {
        // 获取数据库版本
        let databaseVersion = "Unknown";
        try {
            const versionResult = await befly.db.query("SELECT VERSION() as version");
            databaseVersion = versionResult.data?.[0]?.version || "Unknown";
        } catch {
            // 忽略错误
        }

        // 获取 Redis 版本
        let redisVersion = "未配置";
        if (befly.redis) {
            try {
                const info = await befly.redis.info("server");
                const match = info.match(/redis_version:([^\r\n]+)/);
                if (match) {
                    redisVersion = match[1];
                }
            } catch {
                redisVersion = "未知";
            }
        }

        return befly.tool.Yes("获取成功", {
            os: `${os.type()} ${os.arch()}`,
            server: `${os.platform()} ${os.release()}`,
            nodeVersion: process.version,
            database: `MySQL ${databaseVersion}`,
            cache: `Redis ${redisVersion}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
    }
};

export default route;
