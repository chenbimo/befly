import type { BeflyPlugin } from '../types';
import { Logger } from '../lib/logger';
import { No } from '../response';

/**
 * 接口限流插件
 *
 * 功能：
 * 1. 基于 Redis 实现滑动窗口或固定窗口限流
 * 2. 支持配置格式 "count/seconds" (e.g. "10/60")
 * 3. 针对每个用户(userId)或IP进行限制
 */
export default {
    name: 'rateLimit',
    // 必须在 auth 之后（获取 userId），但在业务逻辑之前
    after: ['auth'],

    init: (befly) => {
        if (!befly.redis) {
            Logger.warn('RateLimit plugin requires Redis plugin to be loaded first.');
        }
    },

    onRequest: async (befly, ctx, next) => {
        const { api } = ctx;

        // 1. 检查配置
        if (!api || !api.rateLimit || !befly.redis) {
            return next();
        }

        // 2. 解析配置 "10/60" -> count=10, seconds=60
        const [countStr, secondsStr] = api.rateLimit.split('/');
        const limitCount = parseInt(countStr, 10);
        const limitSeconds = parseInt(secondsStr, 10);

        if (isNaN(limitCount) || isNaN(limitSeconds)) {
            Logger.warn(`[RateLimit] Invalid config: ${api.rateLimit}`);
            return next();
        }

        // 3. 生成 Key
        // 优先使用 userId，否则使用 IP
        const identifier = ctx.user?.userId || ctx.ip;
        const key = `rate_limit:${ctx.route}:${identifier}`;

        try {
            // 4. 执行限流逻辑 (使用 Redis INCR)
            // 这是一个简单的固定窗口算法，对于严格场景可能需要 Lua 脚本实现滑动窗口
            const current = await befly.redis.incr(key);

            if (current === 1) {
                // 第一次访问，设置过期时间
                await befly.redis.expire(key, limitSeconds);
            }

            if (current > limitCount) {
                Logger.warn(`[RateLimit] Blocked: ${ctx.route} for ${identifier} (${current}/${limitCount})`);
                // 返回 429 Too Many Requests 语义的错误
                ctx.result = No('请求过于频繁，请稍后再试', null, 429);
                return;
            }
        } catch (e) {
            Logger.error(`[RateLimit] Redis error: ${e.message}`);
            // Redis 故障时，默认放行，避免阻塞业务
        }

        await next();
    }
} as BeflyPlugin;
