import { redis } from 'bun';
import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';

export default {
    after: ['_logger'],
    async onInit(befly) {
        try {
            if (Env.REDIS_ENABLE === 1) {
                if ((await redis.ping()) !== 'PONG') {
                    throw new Error('Redis 连接失败');
                }

                return {
                    // 添加对象存储辅助方法
                    setObject: async (key, obj, ttl = null) => {
                        try {
                            const data = JSON.stringify(obj);
                            if (ttl) {
                                return await redis.setEx(`${process.env.REDIS_KEY_PREFIX}:${key}`, ttl, data);
                            }
                            return await redis.set(`${process.env.REDIS_KEY_PREFIX}:${key}`, data);
                        } catch (error) {
                            Logger.error({
                                msg: 'Redis setObject 错误',
                                message: error.message,
                                stack: error.stack
                            });
                        }
                    },

                    getObject: async (key) => {
                        try {
                            const data = await redis.get(`${process.env.REDIS_KEY_PREFIX}:${key}`);
                            return data ? JSON.parse(data) : null;
                        } catch (error) {
                            Logger.error({
                                msg: 'Redis getObject 错误',
                                message: error.message,
                                stack: error.stack
                            });
                            return null;
                        }
                    },

                    delObject: async (key) => {
                        try {
                            await redis.del(`${process.env.REDIS_KEY_PREFIX}:${key}`);
                        } catch (error) {
                            Logger.error({
                                msg: 'Redis delObject 错误',
                                message: error.message,
                                stack: error.stack
                            });
                        }
                    },

                    // 添加时序ID生成函数
                    genTimeID: async () => {
                        const timestamp = Math.floor(Date.now() / 1000);
                        const key = `time_id_counter:${timestamp}`;

                        const counter = await redis.incr(key);
                        await redis.expire(key, 2);

                        // 前3位计数器 + 后3位随机数
                        const counterPrefix = (counter % 1000).toString().padStart(3, '0'); // 000-999
                        const randomSuffix = Math.floor(Math.random() * 1000)
                            .toString()
                            .padStart(3, '0'); // 000-999
                        const suffix = `${counterPrefix}${randomSuffix}`;

                        return Number(`${timestamp}${suffix}`);
                    }
                };
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
