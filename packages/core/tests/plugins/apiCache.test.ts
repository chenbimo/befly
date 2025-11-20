import { describe, it, expect, mock, beforeEach } from 'bun:test';
import apiCachePlugin from '../../plugins/apiCache';
import { Logger } from '../../lib/logger';

// Mock Logger
mock.module('../../lib/logger', () => ({
    Logger: {
        warn: mock(),
        debug: mock()
    }
}));

describe('ApiCache Plugin', () => {
    let ctx: any;
    let next: any;
    let befly: any;

    beforeEach(() => {
        befly = {
            redis: {
                get: mock().mockResolvedValue(null),
                set: mock().mockResolvedValue('OK')
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
        await apiCachePlugin.onRequest(befly, ctx, next);
        expect(next).toHaveBeenCalled();
        expect(befly.redis.get).not.toHaveBeenCalled();
    });

    it('should skip if redis is not available', async () => {
        befly.redis = undefined;
        await apiCachePlugin.onRequest(befly, ctx, next);
        expect(next).toHaveBeenCalled();
    });

    it('should return cached result if available', async () => {
        const cachedResult = { code: 0, data: 'cached' };
        befly.redis.get.mockResolvedValue(JSON.stringify(cachedResult));

        await apiCachePlugin.onRequest(befly, ctx, next);

        expect(befly.redis.get).toHaveBeenCalled();
        expect(ctx.result).toEqual(cachedResult);
        expect(next).not.toHaveBeenCalled(); // Should not call next middleware
    });

    it('should execute next and cache result if cache miss', async () => {
        await apiCachePlugin.onRequest(befly, ctx, next);

        expect(befly.redis.get).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
        expect(befly.redis.set).toHaveBeenCalled();

        // Verify cache key generation
        const expectedKey = `api_cache:/test/api:${JSON.stringify({ id: 1 })}`;
        expect(befly.redis.set).toHaveBeenCalledWith(expectedKey, JSON.stringify(ctx.result), 'EX', 60);
    });

    it('should not cache if result code is not 0', async () => {
        ctx.result.code = 1;
        await apiCachePlugin.onRequest(befly, ctx, next);

        expect(next).toHaveBeenCalled();
        expect(befly.redis.set).not.toHaveBeenCalled();
    });
});
