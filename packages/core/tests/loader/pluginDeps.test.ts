import { describe, it, expect, mock } from 'bun:test';
import { sortPlugins } from '../../loader/loadPlugins';
import type { Plugin } from '../../types/plugin';
import { Logger } from '../../lib/logger';

// Mock Logger to avoid console output during tests
mock.module('../../lib/logger', () => ({
    Logger: {
        error: mock(),
        info: mock(),
        warn: mock()
    }
}));

describe('Plugin Dependency Sorting', () => {
    it('should sort plugins correctly based on dependencies', () => {
        const plugins: Plugin[] = [{ pluginName: 'a', after: ['b'] } as any, { pluginName: 'b' } as any, { pluginName: 'c', after: ['a'] } as any];

        const sorted = sortPlugins(plugins);
        expect(sorted).not.toBe(false);
        if (sorted) {
            const names = sorted.map((p) => p.pluginName);
            expect(names.indexOf('b')).toBeLessThan(names.indexOf('a'));
            expect(names.indexOf('a')).toBeLessThan(names.indexOf('c'));
        }
    });

    it('should fail when a dependency is missing', () => {
        const plugins: Plugin[] = [{ pluginName: 'a', after: ['missing'] } as any];

        const sorted = sortPlugins(plugins);
        expect(sorted).toBe(false);
        expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('未找到'));
    });

    it('should fail when there is a circular dependency', () => {
        const plugins: Plugin[] = [{ pluginName: 'a', after: ['b'] } as any, { pluginName: 'b', after: ['a'] } as any];

        const sorted = sortPlugins(plugins);
        expect(sorted).toBe(false);
        expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('循环依赖'));
    });

    it('should handle complex dependencies', () => {
        const plugins: Plugin[] = [{ pluginName: 'auth', after: ['db', 'redis'] } as any, { pluginName: 'db' } as any, { pluginName: 'redis' } as any, { pluginName: 'api', after: ['auth'] } as any];

        const sorted = sortPlugins(plugins);
        expect(sorted).not.toBe(false);
        if (sorted) {
            const names = sorted.map((p) => p.pluginName);
            expect(names.indexOf('db')).toBeLessThan(names.indexOf('auth'));
            expect(names.indexOf('redis')).toBeLessThan(names.indexOf('auth'));
            expect(names.indexOf('auth')).toBeLessThan(names.indexOf('api'));
        }
    });
});
