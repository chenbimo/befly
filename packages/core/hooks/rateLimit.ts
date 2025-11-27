// 相对导入
import { Logger } from '../lib/logger.js';
import { ErrorResponse } from '../util.js';

// 类型导入
import type { Hook } from '../types/hook.js';

/**
 * 接口限流插件
 *
 * 功能：
 * 1. 基于 Redis 实现滑动窗口或固定窗口限流
 * 2. 支持配置格式 "count/seconds" (e.g. "10/60")
 * 3. 针对每个用户(userId)或IP进行限制
 */
const hook: Hook = {
    order: 7,
    handler: async (befly, ctx) => {
        const { api } = ctx;

        // 1. 检查配置
        if (!api || !api.rateLimit || !befly.redis) {
            return;
        }

        // 2. 解析配置 "10/60" -> count=10, seconds=60
        const [countStr, secondsStr] = api.rateLimit.split('/');
        const limitCount = parseInt(countStr, 10);
        const limitSeconds = parseInt(secondsStr, 10);

        if (isNaN(limitCount) || isNaN(limitSeconds)) {
            Logger.warn(`[RateLimit] Invalid config: ${api.rateLimit}`);
            return;
        }

        // 3. 生成 Key
        // 优先使用 userId，否则使用 IP
        const identifier = ctx.user?.userId || ctx.ip || 'unknown';
        const apiPath = ctx.route || `${ctx.req.method}${new URL(ctx.req.url).pathname}`;
        const key = `rate_limit:${apiPath}:${identifier}`;

        try {
            // 4. 执行限流逻辑 (使用 Redis INCR)
            // 这是一个简单的固定窗口算法，对于严格场景可能需要 Lua 脚本实现滑动窗口
            const current = await befly.redis.incr(key);

            // 5. 设置过期时间 (如果是新 Key)
            if (current === 1) {
                await befly.redis.expire(key, limitSeconds);
            }

            // 6. 判断是否超限
            if (current > limitCount) {
                ctx.response = ErrorResponse(ctx, '请求过于频繁，请稍后再试');
                return;
            }
        } catch (err) {
            Logger.error('[RateLimit] Redis error:', err);
            // Redis 故障时，默认放行，避免阻塞业务
        }
    }
};

export default hook;
