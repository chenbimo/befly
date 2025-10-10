import { Env } from '../../config/env.js';
import { Api } from '../../utils/api.js';
import { Yes, No } from '../../utils/index.js';

export default Api.POST(
    //
    '健康检查',
    false,
    {},
    [],
    async (befly, ctx) => {
        try {
            const info = {
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
                        await befly.redis.ping();
                        info.redis = '已连接';
                    } catch (error) {
                        info.redis = '未连接';
                        info.redisError = error.message;
                    }
                } else {
                    info.redis = '未开启';
                }
            } else {
                info.redis = '禁用';
            }
            return Yes('健康检查成功', info);
        } catch (error) {
            befly.logger.error({
                msg: '健康检查失败',
                error: error.message,
                stack: error.stack
            });
            return No('健康检查失败');
        }
    }
);
