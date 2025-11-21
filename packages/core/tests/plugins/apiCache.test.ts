import { describe, it, expect, mock, beforeEach } from 'bun:test';
import apiCacheHook from '../../hooks/apiCache';
import { Logger } from '../../lib/logger';

// Mock Logger
mock.module('../../lib/logger', () => ({
    Logger: {
        warn: mock(),
        debug: mock(),
        error: mock()
    }
}));

describe('ApiCache Hook', () => {
    let ctx: any;
    let next: any;
    let befly: any;

    beforeEach(() => {
        befly = {
            redis: {
                get: mock().mockResolvedValue(null),
                setex: mock().mockResolvedValue('OK')
            }
        };
        ctx = {
            befly,
            api: { cache: 60 },
            route: '/test/api',
            body: { id: 1 },
            result: { code: 0, data: 'test' }
        };
        next = mock().mockResolvedValue(undefined);
    });

    it('should skip if cache is not enabled in api config', async () => {
        ctx.api.cache = undefined;
        await apiCacheHook.handler(befly, ctx, next);
        expect(next).toHaveBeenCalled();
        expect(befly.redis.get).not.toHaveBeenCalled();
    });

    it('should skip if redis is not available', async () => {
        befly.redis = undefined;
        await apiCacheHook.handler(befly, ctx, next);
        expect(next).toHaveBeenCalled();
    });

    it('should return cached result if available', async () => {
        const cachedResult = { code: 0, data: 'cached' };
        befly.redis.get.mockResolvedValue(JSON.stringify(cachedResult));

        await apiCacheHook.handler(befly, ctx, next);

        expect(befly.redis.get).toHaveBeenCalled();
        expect(ctx.result).toEqual(cachedResult);
        // Should NOT call next() if cache hit?
        // Wait, let's check the implementation.
        // If cache hit, it sets ctx.result and returns (does NOT call next).
        expect(next).not.toHaveBeenCalled();
    });

    it('should call next and cache result if cache miss', async () => {
        await apiCacheHook.handler(befly, ctx, next);

        expect(befly.redis.get).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
        expect(befly.redis.setex).toHaveBeenCalled();
    });
});
