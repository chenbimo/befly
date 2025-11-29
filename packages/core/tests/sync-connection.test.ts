/**
 * sync 模块连接管理集成测试
 * 验证数据库连接的正确关闭
 */
import { describe, test, expect, afterEach } from 'bun:test';

import { Connect } from '../lib/connect.js';

describe('sync 模块连接管理', () => {
    afterEach(() => {
        // 每个测试后重置连接状态
        Connect.__reset();
    });

    describe('Connect.isConnected', () => {
        test('初始状态应该都是未连接', () => {
            const status = Connect.isConnected();
            expect(status.sql).toBe(false);
            expect(status.redis).toBe(false);
        });
    });

    describe('Connect.disconnect', () => {
        test('disconnect 应该能安全地关闭未连接的状态', async () => {
            // 即使没有连接，disconnect 也不应该抛出错误
            await expect(Connect.disconnect()).resolves.toBeUndefined();
        });

        test('disconnectSql 应该能安全地关闭未连接的状态', async () => {
            await expect(Connect.disconnectSql()).resolves.toBeUndefined();
        });

        test('disconnectRedis 应该能安全地关闭未连接的状态', async () => {
            await expect(Connect.disconnectRedis()).resolves.toBeUndefined();
        });
    });

    describe('Connect.getSql', () => {
        test('未连接时应该抛出错误', () => {
            expect(() => Connect.getSql()).toThrow('SQL 客户端未连接');
        });
    });

    describe('Connect.getRedis', () => {
        test('未连接时应该抛出错误', () => {
            expect(() => Connect.getRedis()).toThrow('Redis 客户端未连接');
        });
    });

    describe('Mock 连接测试', () => {
        test('__setMockSql 应该设置 mock SQL 客户端', () => {
            const mockSql = { close: async () => {} } as any;
            Connect.__setMockSql(mockSql);

            const status = Connect.isConnected();
            expect(status.sql).toBe(true);
            expect(status.redis).toBe(false);
        });

        test('__setMockRedis 应该设置 mock Redis 客户端', () => {
            const mockRedis = { close: () => {} } as any;
            Connect.__setMockRedis(mockRedis);

            const status = Connect.isConnected();
            expect(status.sql).toBe(false);
            expect(status.redis).toBe(true);
        });

        test('__reset 应该重置所有连接', () => {
            const mockSql = { close: async () => {} } as any;
            const mockRedis = { close: () => {} } as any;
            Connect.__setMockSql(mockSql);
            Connect.__setMockRedis(mockRedis);

            expect(Connect.isConnected().sql).toBe(true);
            expect(Connect.isConnected().redis).toBe(true);

            Connect.__reset();

            expect(Connect.isConnected().sql).toBe(false);
            expect(Connect.isConnected().redis).toBe(false);
        });

        test('disconnect 应该正确关闭 mock 连接', async () => {
            let sqlClosed = false;
            let redisClosed = false;

            const mockSql = {
                close: async () => {
                    sqlClosed = true;
                }
            } as any;
            const mockRedis = {
                close: () => {
                    redisClosed = true;
                }
            } as any;

            Connect.__setMockSql(mockSql);
            Connect.__setMockRedis(mockRedis);

            await Connect.disconnect();

            expect(sqlClosed).toBe(true);
            expect(redisClosed).toBe(true);
            expect(Connect.isConnected().sql).toBe(false);
            expect(Connect.isConnected().redis).toBe(false);
        });
    });

    describe('连接异常处理', () => {
        test('disconnectSql 应该处理关闭时的错误', async () => {
            const mockSql = {
                close: async () => {
                    throw new Error('Close error');
                }
            } as any;

            Connect.__setMockSql(mockSql);

            // 不应该抛出错误，只是记录日志
            await expect(Connect.disconnectSql()).resolves.toBeUndefined();
            expect(Connect.isConnected().sql).toBe(false);
        });

        test('disconnectRedis 应该处理关闭时的错误', async () => {
            const mockRedis = {
                close: () => {
                    throw new Error('Close error');
                }
            } as any;

            Connect.__setMockRedis(mockRedis);

            // 不应该抛出错误，只是记录日志
            await expect(Connect.disconnectRedis()).resolves.toBeUndefined();
            expect(Connect.isConnected().redis).toBe(false);
        });
    });

    describe('Connect.getStatus', () => {
        test('未连接时返回正确的状态', () => {
            const status = Connect.getStatus();

            expect(status.sql.connected).toBe(false);
            expect(status.sql.connectedAt).toBeNull();
            expect(status.sql.uptime).toBeNull();
            expect(status.sql.poolMax).toBe(1);

            expect(status.redis.connected).toBe(false);
            expect(status.redis.connectedAt).toBeNull();
            expect(status.redis.uptime).toBeNull();
        });

        test('Mock 连接后返回正确的状态', () => {
            const mockSql = { close: async () => {} } as any;
            const mockRedis = { close: () => {} } as any;

            Connect.__setMockSql(mockSql);
            Connect.__setMockRedis(mockRedis);

            const status = Connect.getStatus();

            // Mock 不会设置连接时间，但连接状态应该为 true
            expect(status.sql.connected).toBe(true);
            expect(status.redis.connected).toBe(true);
        });

        test('__reset 应该重置所有状态包括连接时间', () => {
            const mockSql = { close: async () => {} } as any;
            Connect.__setMockSql(mockSql);

            expect(Connect.getStatus().sql.connected).toBe(true);

            Connect.__reset();

            const status = Connect.getStatus();
            expect(status.sql.connected).toBe(false);
            expect(status.sql.connectedAt).toBeNull();
            expect(status.sql.poolMax).toBe(1);
        });
    });
});
