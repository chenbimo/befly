/**
 * RedisHelper 测试
 * 测试 Redis 操作功能
 */

import { describe, expect, it, test, beforeAll, afterAll } from 'bun:test';
import { RedisClient } from 'bun';

import { config } from '../config.js';
import { Connect } from '../lib/connect.js';
import { RedisHelper } from '../lib/redisHelper.js';

let redis: RedisHelper;

beforeAll(async () => {
    // 连接 Redis
    await Connect.connectRedis(config.redis);
    redis = new RedisHelper();
});

afterAll(async () => {
    // 断开 Redis 连接
    await Connect.disconnectRedis();
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
        // 先清除，确保测试隔离
        await redis.del('test:set:sadd');
        const count = await redis.sadd('test:set:sadd', ['member1', 'member2', 'member3']);
        expect(count).toBeGreaterThan(0);
        await redis.del('test:set:sadd');
    });

    test('sismember - 检查成员是否存在', async () => {
        await redis.del('test:set');
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

    test('saddBatch - 批量向多个 Set 添加成员', async () => {
        const count = await redis.saddBatch([
            { key: 'test:saddBatch:1', members: ['a', 'b'] },
            { key: 'test:saddBatch:2', members: ['c', 'd', 'e'] }
        ]);
        expect(count).toBe(5);

        // 验证
        const members1 = await redis.smembers('test:saddBatch:1');
        const members2 = await redis.smembers('test:saddBatch:2');
        expect(members1.length).toBe(2);
        expect(members2.length).toBe(3);

        // 清理
        await redis.delBatch(['test:saddBatch:1', 'test:saddBatch:2']);
    });

    test('saddBatch - 空数组返回 0', async () => {
        const count = await redis.saddBatch([]);
        expect(count).toBe(0);
    });

    test('sismemberBatch - 批量检查成员是否存在', async () => {
        await redis.sadd('test:sismemberBatch', ['a', 'b', 'c']);

        const results = await redis.sismemberBatch([
            { key: 'test:sismemberBatch', member: 'a' },
            { key: 'test:sismemberBatch', member: 'b' },
            { key: 'test:sismemberBatch', member: 'x' }
        ]);
        expect(results).toEqual([true, true, false]);

        // 清理
        await redis.del('test:sismemberBatch');
    });

    test('sismemberBatch - 空数组返回空数组', async () => {
        const results = await redis.sismemberBatch([]);
        expect(results).toEqual([]);
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

    test('ttlBatch - 批量获取剩余过期时间', async () => {
        await redis.setString('test:ttlBatch:1', 'value1', 60);
        await redis.setString('test:ttlBatch:2', 'value2', 120);
        // test:ttlBatch:3 不存在

        const results = await redis.ttlBatch(['test:ttlBatch:1', 'test:ttlBatch:2', 'test:ttlBatch:3']);
        expect(results.length).toBe(3);
        expect(results[0]).toBeGreaterThan(0);
        expect(results[0]).toBeLessThanOrEqual(60);
        expect(results[1]).toBeGreaterThan(0);
        expect(results[1]).toBeLessThanOrEqual(120);
        expect(results[2]).toBe(-2); // 键不存在

        // 清理
        await redis.delBatch(['test:ttlBatch:1', 'test:ttlBatch:2']);
    });

    test('ttlBatch - 空数组返回空数组', async () => {
        const results = await redis.ttlBatch([]);
        expect(results).toEqual([]);
    });

    test('ttlBatch - 无过期时间返回 -1', async () => {
        await redis.setString('test:ttlBatch:nox', 'value'); // 无 TTL

        const results = await redis.ttlBatch(['test:ttlBatch:nox']);
        expect(results[0]).toBe(-1);

        // 清理
        await redis.del('test:ttlBatch:nox');
    });

    test('del - 删除键', async () => {
        await redis.setString('test:delete:key', 'value');

        const count = await redis.del('test:delete:key');
        expect(count).toBe(1);

        const value = await redis.getString('test:delete:key');
        expect(value).toBeNull();
    });

    test('delBatch - 批量删除键', async () => {
        // 创建多个键
        await redis.setString('test:batch:1', 'value1');
        await redis.setString('test:batch:2', 'value2');
        await redis.setString('test:batch:3', 'value3');

        // 批量删除
        const count = await redis.delBatch(['test:batch:1', 'test:batch:2', 'test:batch:3']);
        expect(count).toBe(3);

        // 验证删除成功
        const value1 = await redis.getString('test:batch:1');
        const value2 = await redis.getString('test:batch:2');
        const value3 = await redis.getString('test:batch:3');
        expect(value1).toBeNull();
        expect(value2).toBeNull();
        expect(value3).toBeNull();
    });

    test('delBatch - 空数组返回 0', async () => {
        const count = await redis.delBatch([]);
        expect(count).toBe(0);
    });

    test('delBatch - 删除不存在的键返回 0', async () => {
        const count = await redis.delBatch(['test:non:existent:1', 'test:non:existent:2']);
        expect(count).toBe(0);
    });

    test('delBatch - 部分存在的键', async () => {
        await redis.setString('test:partial:1', 'value1');
        await redis.setString('test:partial:2', 'value2');
        // test:partial:3 不存在

        const count = await redis.delBatch(['test:partial:1', 'test:partial:2', 'test:partial:3']);
        expect(count).toBe(2); // 只有 2 个键被删除
    });

    test('setBatch - 批量设置对象', async () => {
        const items = [
            { key: 'test:setBatch:1', value: { name: 'Alice' } },
            { key: 'test:setBatch:2', value: { name: 'Bob' } },
            { key: 'test:setBatch:3', value: { name: 'Charlie' } }
        ];

        const count = await redis.setBatch(items);
        expect(count).toBe(3);

        // 验证设置成功
        const value1 = await redis.getObject('test:setBatch:1');
        const value2 = await redis.getObject('test:setBatch:2');
        const value3 = await redis.getObject('test:setBatch:3');
        expect(value1).toEqual({ name: 'Alice' });
        expect(value2).toEqual({ name: 'Bob' });
        expect(value3).toEqual({ name: 'Charlie' });

        // 清理
        await redis.delBatch(['test:setBatch:1', 'test:setBatch:2', 'test:setBatch:3']);
    });

    test('setBatch - 空数组返回 0', async () => {
        const count = await redis.setBatch([]);
        expect(count).toBe(0);
    });

    test('setBatch - 带 TTL 的批量设置', async () => {
        const items = [
            { key: 'test:setBatch:ttl:1', value: { data: 1 }, ttl: 10 },
            { key: 'test:setBatch:ttl:2', value: { data: 2 }, ttl: 10 }
        ];

        const count = await redis.setBatch(items);
        expect(count).toBe(2);

        // 验证 TTL 已设置
        const ttl1 = await redis.ttl('test:setBatch:ttl:1');
        const ttl2 = await redis.ttl('test:setBatch:ttl:2');
        expect(ttl1).toBeGreaterThan(0);
        expect(ttl1).toBeLessThanOrEqual(10);
        expect(ttl2).toBeGreaterThan(0);
        expect(ttl2).toBeLessThanOrEqual(10);

        // 清理
        await redis.delBatch(['test:setBatch:ttl:1', 'test:setBatch:ttl:2']);
    });

    test('getBatch - 批量获取对象', async () => {
        // 设置测试数据
        await redis.setObject('test:getBatch:1', { name: 'Alice' });
        await redis.setObject('test:getBatch:2', { name: 'Bob' });
        await redis.setObject('test:getBatch:3', { name: 'Charlie' });

        // 批量获取
        const results = await redis.getBatch(['test:getBatch:1', 'test:getBatch:2', 'test:getBatch:3']);
        expect(results.length).toBe(3);
        expect(results[0]).toEqual({ name: 'Alice' });
        expect(results[1]).toEqual({ name: 'Bob' });
        expect(results[2]).toEqual({ name: 'Charlie' });

        // 清理
        await redis.delBatch(['test:getBatch:1', 'test:getBatch:2', 'test:getBatch:3']);
    });

    test('getBatch - 空数组返回空数组', async () => {
        const results = await redis.getBatch([]);
        expect(results).toEqual([]);
    });

    test('getBatch - 不存在的键返回 null', async () => {
        const results = await redis.getBatch(['test:non:existent:a', 'test:non:existent:b']);
        expect(results).toEqual([null, null]);
    });

    test('getBatch - 部分存在的键', async () => {
        await redis.setObject('test:partial:a', { data: 'a' });
        // test:partial:b 不存在

        const results = await redis.getBatch(['test:partial:a', 'test:partial:b']);
        expect(results.length).toBe(2);
        expect(results[0]).toEqual({ data: 'a' });
        expect(results[1]).toBeNull();

        // 清理
        await redis.del('test:partial:a');
    });

    test('existsBatch - 批量检查键是否存在', async () => {
        await redis.setString('test:existsBatch:1', 'value1');
        await redis.setString('test:existsBatch:2', 'value2');
        // test:existsBatch:3 不存在

        const results = await redis.existsBatch(['test:existsBatch:1', 'test:existsBatch:2', 'test:existsBatch:3']);
        expect(results).toEqual([true, true, false]);

        // 清理
        await redis.delBatch(['test:existsBatch:1', 'test:existsBatch:2']);
    });

    test('existsBatch - 空数组返回空数组', async () => {
        const results = await redis.existsBatch([]);
        expect(results).toEqual([]);
    });

    test('existsBatch - 全部不存在', async () => {
        const results = await redis.existsBatch(['test:none:1', 'test:none:2']);
        expect(results).toEqual([false, false]);
    });

    test('expireBatch - 批量设置过期时间', async () => {
        await redis.setString('test:expireBatch:1', 'value1');
        await redis.setString('test:expireBatch:2', 'value2');

        const count = await redis.expireBatch([
            { key: 'test:expireBatch:1', seconds: 60 },
            { key: 'test:expireBatch:2', seconds: 120 }
        ]);
        expect(count).toBe(2);

        // 验证 TTL 已设置
        const ttl1 = await redis.ttl('test:expireBatch:1');
        const ttl2 = await redis.ttl('test:expireBatch:2');
        expect(ttl1).toBeGreaterThan(0);
        expect(ttl1).toBeLessThanOrEqual(60);
        expect(ttl2).toBeGreaterThan(0);
        expect(ttl2).toBeLessThanOrEqual(120);

        // 清理
        await redis.delBatch(['test:expireBatch:1', 'test:expireBatch:2']);
    });

    test('expireBatch - 空数组返回 0', async () => {
        const count = await redis.expireBatch([]);
        expect(count).toBe(0);
    });

    test('expireBatch - 不存在的键返回 0', async () => {
        const count = await redis.expireBatch([
            { key: 'test:expire:none:1', seconds: 60 },
            { key: 'test:expire:none:2', seconds: 60 }
        ]);
        expect(count).toBe(0);
    });

    test('expireBatch - 部分存在的键', async () => {
        await redis.setString('test:expire:partial:1', 'value1');
        // test:expire:partial:2 不存在

        const count = await redis.expireBatch([
            { key: 'test:expire:partial:1', seconds: 60 },
            { key: 'test:expire:partial:2', seconds: 60 }
        ]);
        expect(count).toBe(1);

        // 清理
        await redis.del('test:expire:partial:1');
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
