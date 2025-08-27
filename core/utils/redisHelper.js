import { redis as bunRedis } from 'bun';
import { Env } from '../config/env.js';
import { Logger } from './logger.js';

const prefix = Env.REDIS_KEY_PREFIX ? `${Env.REDIS_KEY_PREFIX}:` : '';

let redisClient = bunRedis;
export const setRedisClient = (client) => {
    redisClient = client || bunRedis;
};
export const getRedisClient = () => redisClient;

export const RedisHelper = {
    async setObject(key, obj, ttl = null) {
        try {
            const data = JSON.stringify(obj);
            const pkey = `${prefix}${key}`;
            if (ttl) {
                return await redisClient.setEx(pkey, ttl, data);
            }
            return await redisClient.set(pkey, data);
        } catch (error) {
            Logger.error({
                msg: 'Redis setObject 错误',
                message: error.message,
                stack: error.stack
            });
        }
    },

    async getObject(key) {
        try {
            const pkey = `${prefix}${key}`;
            const data = await redisClient.get(pkey);
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

    async delObject(key) {
        try {
            const pkey = `${prefix}${key}`;
            await redisClient.del(pkey);
        } catch (error) {
            Logger.error({
                msg: 'Redis delObject 错误',
                message: error.message,
                stack: error.stack
            });
        }
    },

    async genTimeID() {
        const timestamp = Math.floor(Date.now() / 1000);
        const key = `${prefix}time_id_counter:${timestamp}`;

        const counter = await redisClient.incr(key);
        await redisClient.expire(key, 2);

        const counterPrefix = (counter % 1000).toString().padStart(3, '0');
        const randomSuffix = Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, '0');
        const suffix = `${counterPrefix}${randomSuffix}`;

        return Number(`${timestamp}${suffix}`);
    }
};
