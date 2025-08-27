import { redis } from 'bun';
import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { RedisHelper, getRedisClient } from '../utils/redisHelper.js';

export default {
    after: ['_logger'],
    async onInit(befly) {
        try {
            if (Env.REDIS_ENABLE === 1) {
                const client = getRedisClient();
                if ((await client.ping()) !== 'PONG') {
                    throw new Error('Redis 连接失败');
                }

                // 返回工具对象，向下游以相同 API 暴露
                return RedisHelper;
            } else {
                Logger.warn(`Redis 未启用，跳过初始化`);
                return {};
            }
        } catch (err) {
            Logger.error({
                msg: 'Redis 初始化失败',
                message: err.message,
                stack: err.stack
            });
            // 插件内禁止直接退出进程，抛出异常交由主流程统一处理
            throw err;
        }
    }
};
