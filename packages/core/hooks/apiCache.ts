import type { Hook } from '../types/hook.js';
import { Logger } from '../lib/logger';

/**
 * API 缓存插件
 *
 * 功能：
 * 1. 基于 Redis 缓存 API 响应结果
 * 2. 仅缓存 GET 请求或明确配置了 cache 的接口
 * 3. 缓存键生成规则：api_cache:{route}:{md5(body)}
 */
const hook: Hook = {
    name: 'apiCache',
    // 必须在解析器之后，但在业务逻辑之前
    after: ['parser', 'auth'],

    handler: async (befly, ctx, next) => {
        const { api } = ctx;

        // 1. 检查是否启用缓存
        // 只有明确配置了 cache 时间（秒）的接口才缓存
        if (!api || !api.cache || api.cache <= 0 || !befly.redis) {
            return next();
        }

        // 2. 生成缓存 Key
        // 包含：路由路径 + 请求参数摘要
        // 简单起见，这里直接使用 JSON 字符串作为 key 的一部分
        // 实际生产中可能需要更复杂的 key 生成策略（如排序键值对后 hash）
        const paramKey = JSON.stringify(ctx.body || {});
        // 使用简单的 hash 避免 key 过长 (这里简化处理，直接用 base64 或类似，或者直接拼接如果 body 不大)
        // 为了性能和简单，这里假设 body 不会特别巨大，直接拼接，或者使用简单的字符串替换
        const cacheKey = `api_cache:${ctx.route}:${paramKey}`;

        // 3. 尝试获取缓存
        try {
            const cached = await befly.redis.get(cacheKey);
            if (cached) {
                try {
                    const result = JSON.parse(cached);
                    ctx.result = result;
                    Logger.debug(`[ApiCache] Hit: ${ctx.route}`);
                    return; // 直接返回，跳过后续处理
                } catch (e) {
                    // 解析失败，忽略缓存
                }
            }
        } catch (e) {
            Logger.warn(`[ApiCache] Redis get error: ${e.message}`);
        }

        // 4. 执行后续逻辑
        await next();

        // 5. 记录需要缓存
        ctx.cache = {
            key: cacheKey,
            ttl: api.cache
        };

        await next();

        // 6. 响应后写入缓存 (在 responseFormatter 之后，或者在业务逻辑返回后)
        // 注意：这里 next() 返回后，ctx.result 应该已经被业务逻辑填充
        if (ctx.result !== undefined && ctx.cache) {
            try {
                const cacheValue = JSON.stringify(ctx.result);
                await befly.redis.setex(ctx.cache.key, ctx.cache.ttl, cacheValue);
            } catch (err) {
                Logger.error('[ApiCache] Set cache error:', err);
            }
        }
    }
};

export default hook;
