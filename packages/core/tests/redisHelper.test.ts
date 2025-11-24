/**
 * RedisHelper 测试
 * 测试 Redis 操作功能
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from '../lib/database.js';
import { RedisHelper } from '../lib/redisHelper.js';
import { defaultOptions } from '../config.js';

let redis: RedisHelper;

beforeAll(async () => {
    // 使用项目默认配置连接 Redis
    await Database.connectRedis(defaultOptions.redis);
    // 使用项目配置的 prefix
    redis = new RedisHelper(defaultOptions.redis.prefix);
});

afterAll(async () => {
    // 清理测试数据
    await redis.del('test:string');
    await redis.del('test:object');
    await redis.del('test:set');
    await redis.del('test:ttl');
    await redis.del('test:expire');

    await Database.disconnectRedis();
});

describe('RedisHelper - 字符串操作', () => {
    test('setString - 设置字符串', async () => {
        const result = await redis.setString('test:string', 'Hello Redis');
        expect(result).toBe('OK');
    });

    test('getString - 获取字符串', async () => {
        await redis.setString('test:string', 'Hello Redis');
        const value = await redis.getString('test:string');
        expect(value).toBe('Hello Redis');
    });

    test('getString - 获取不存在的键', async () => {
        const value = await redis.getString('test:non_existent');
        expect(value).toBeNull();
    });

    test('setString - 设置带过期时间的字符串', async () => {
        const result = await redis.setString('test:ttl', 'Expire Test', 2);
        expect(result).toBe('OK');

        const value = await redis.getString('test:ttl');
        expect(value).toBe('Expire Test');

        // 等待过期
        await new Promise((resolve) => setTimeout(resolve, 2100));

        const expiredValue = await redis.getString('test:ttl');
        expect(expiredValue).toBeNull();
    });
});

describe('RedisHelper - 对象操作', () => {
    test('setObject - 设置对象', async () => {
        const obj = { name: 'Test', age: 25, tags: ['a', 'b'] };
        const result = await redis.setObject('test:object', obj);
        expect(result).toBe('OK');
    });

    test('getObject - 获取对象', async () => {
        const obj = { name: 'Test', age: 25, tags: ['a', 'b'] };
        await redis.setObject('test:object', obj);

        const value = await redis.getObject<any>('test:object');
        expect(value).toEqual(obj);
    });

    test('getObject - 获取不存在的对象', async () => {
        const value = await redis.getObject('test:non_existent_obj');
        expect(value).toBeNull();
    });

    test('setObject - 设置带过期时间的对象', async () => {
        const obj = { data: 'test' };
        const result = await redis.setObject('test:object:ttl', obj, 1);
        expect(result).toBe('OK');

        await new Promise((resolve) => setTimeout(resolve, 1100));

        const expiredValue = await redis.getObject('test:object:ttl');
        expect(expiredValue).toBeNull();
    });

    test('delObject - 删除对象', async () => {
        await redis.setObject('test:delete', { data: 'test' });
        await redis.delObject('test:delete');

        const value = await redis.getObject('test:delete');
        expect(value).toBeNull();
    });
});

describe('RedisHelper - Set 操作', () => {
    test('sadd - 添加成员到 Set', async () => {
        const count = await redis.sadd('test:set', ['member1', 'member2', 'member3']);
        expect(count).toBeGreaterThan(0);
    });

    test('sismember - 检查成员是否存在', async () => {
        await redis.sadd('test:set', ['member1']);

        const exists = await redis.sismember('test:set', 'member1');
        expect(exists).toBe(true);

        const notExists = await redis.sismember('test:set', 'non_existent');
        expect(notExists).toBe(false);
    });

    test('scard - 获取 Set 成员数量', async () => {
        await redis.del('test:set:count');
        await redis.sadd('test:set:count', ['m1', 'm2', 'm3']);

        const count = await redis.scard('test:set:count');
        expect(count).toBe(3);

        await redis.del('test:set:count');
    });

    test('smembers - 获取所有成员', async () => {
        await redis.del('test:set:members');
        await redis.sadd('test:set:members', ['a', 'b', 'c']);

        const members = await redis.smembers('test:set:members');
        expect(members.length).toBe(3);
        expect(members).toContain('a');
        expect(members).toContain('b');
        expect(members).toContain('c');

        await redis.del('test:set:members');
    });
});

describe('RedisHelper - 键操作', () => {
    test('exists - 检查键是否存在', async () => {
        await redis.setString('test:exists', 'value');

        const exists = await redis.exists('test:exists');
        expect(exists).toBe(true);

        const notExists = await redis.exists('test:not_exists');
        expect(notExists).toBe(false);

        await redis.del('test:exists');
    });

    test('expire - 设置过期时间', async () => {
        await redis.setString('test:expire', 'value');
        const result = await redis.expire('test:expire', 1);
        expect(result).toBe(1);

        await new Promise((resolve) => setTimeout(resolve, 1100));

        const value = await redis.getString('test:expire');
        expect(value).toBeNull();
    });

    test('ttl - 获取剩余过期时间', async () => {
        await redis.setString('test:ttl:check', 'value', 10);

        const ttl = await redis.ttl('test:ttl:check');
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(10);

        await redis.del('test:ttl:check');
    });

    test('del - 删除键', async () => {
        await redis.setString('test:delete:key', 'value');

        const count = await redis.del('test:delete:key');
        expect(count).toBe(1);

        const value = await redis.getString('test:delete:key');
        expect(value).toBeNull();
    });
});

describe('RedisHelper - ID 生成', () => {
    test('genTimeID - 生成唯一 ID', async () => {
        const id1 = await redis.genTimeID();
        const id2 = await redis.genTimeID();

        expect(typeof id1).toBe('number');
        expect(typeof id2).toBe('number');
        expect(id1).not.toBe(id2);
        expect(id1.toString().length).toBe(14);
    });

    test('genTimeIDBatch - 批量生成 ID', async () => {
        const ids = await redis.genTimeIDBatch(10);

        expect(ids.length).toBe(10);
        expect(ids.every((id) => typeof id === 'number')).toBe(true);
        expect(ids.every((id) => id.toString().length === 14)).toBe(true);

        // 验证 ID 唯一性
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(10);
    });

    test('genTimeIDBatch - 空数组', async () => {
        const ids = await redis.genTimeIDBatch(0);
        expect(ids.length).toBe(0);
    });

    test('genTimeIDBatch - 超过最大限制', async () => {
        try {
            await redis.genTimeIDBatch(10001);
            expect(true).toBe(false); // 不应该执行到这里
        } catch (error: any) {
            expect(error.message).toContain('超过最大限制');
        }
    });
});

describe('RedisHelper - 连接测试', () => {
    test('ping - 测试连接', async () => {
        const result = await redis.ping();
        expect(result).toBe('PONG');
    });
});
