/**
 * 健康检查接口
 * 检查服务器、Redis、数据库等状态
 * 路由：GET /api/befly/health/info
 */

import { Api, Yes, Env } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';

interface HealthInfo {
    status: string;
    timestamp: string;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    runtime: string;
    version: string;
    platform: string;
    arch: string;
    redis?: string;
    redisError?: string;
    database?: string;
    databaseError?: string;
}

export default Api('健康检查', {
    auth: false, // 公开接口
    fields: {},
    required: [],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        const info: HealthInfo = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            runtime: 'Bun',
            version: Bun.version,
            platform: process.platform,
            arch: process.arch
        };

        // 检查 Redis 连接状态
        if (Env.REDIS_ENABLE === 1) {
            if (befly.redis) {
                try {
                    await befly.redis.getRedisClient().ping();
                    info.redis = '已连接';
                } catch (error: any) {
                    info.redis = '未连接';
                    info.redisError = error.message;
                }
            } else {
                info.redis = '未开启';
            }
        } else {
            info.redis = '禁用';
        }

        // 检查数据库连接状态
        if (Env.DB_ENABLE === 1) {
            if (befly.db) {
                try {
                    // 执行简单查询测试连接
                    await befly.db.query('SELECT 1');
                    info.database = '已连接';
                } catch (error: any) {
                    info.database = '未连接';
                    info.databaseError = error.message;
                }
            } else {
                info.database = '未开启';
            }
        } else {
            info.database = '禁用';
        }

        return Yes('健康检查成功', info);
    }
});
