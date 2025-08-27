import { test, expect, mock } from 'bun:test';

// 简单的内存型 Redis 模拟器
function createRedisMock() {
    const store = new Map();
    const expireMap = new Map();

    const set = async (key, value) => {
        set._calls.push([key, value]);
        store.set(key, value);
        return 'OK';
    };
    set._calls = [];

    const setEx = async (key, ttl, value) => {
        setEx._calls.push([key, ttl, value]);
        store.set(key, value);
        expireMap.set(key, ttl);
        return 'OK';
    };
    setEx._calls = [];

    const get = async (key) => {
        get._calls.push([key]);
        return store.has(key) ? store.get(key) : null;
    };
    get._calls = [];

    const del = async (key) => {
        del._calls.push([key]);
        store.delete(key);
        expireMap.delete(key);
        return 1;
    };
    del._calls = [];

    const incrMap = new Map();
    const incr = async (key) => {
        incr._calls.push([key]);
        const v = (incrMap.get(key) || 0) + 1;
        incrMap.set(key, v);
        return v;
    };
    incr._calls = [];

    const expire = async (key, ttl) => {
        expire._calls.push([key, ttl]);
        expireMap.set(key, ttl);
        return 1;
    };
    expire._calls = [];

    const ping = async () => 'PONG';

    return {
        api: { set, setEx, get, del, incr, expire, ping },
        internals: { store, expireMap, incrMap }
    };
}

// 统一的模块模拟：Env / Logger / bun.redis
const redisMock = createRedisMock();
mock.module('bun', () => ({ redis: redisMock.api }));
mock.module('../utils/logger.js', () => ({
    Logger: { error() {}, info() {}, warn() {}, debug() {} }
}));
mock.module('../config/env.js', () => ({
    Env: {
        REDIS_ENABLE: 1,
        REDIS_KEY_PREFIX: 'testpfx'
    }
}));

// 动态导入（在 mock.module 之后）
const { RedisHelper, setRedisClient } = await import('../utils/redisHelper.js');
// 注入内存版 redis 客户端
setRedisClient(redisMock.api);
const redisPlugin = (await import('../plugins/redis.js')).default;

// -------- RedisHelper 行为测试 --------

test('RedisHelper setObject/getObject 基本读写', async () => {
    const obj = { a: 1, b: 'x' };
    await RedisHelper.setObject('k1', obj);

    // 断言使用了带前缀的 key
    expect(redisMock.api.set._calls.length).toBe(1);
    const [calledKey, calledVal] = redisMock.api.set._calls[0];
    expect(calledKey).toBe('testpfx:k1');
    expect(JSON.parse(calledVal)).toEqual(obj);

    const got = await RedisHelper.getObject('k1');
    expect(got).toEqual(obj);
});

test('RedisHelper setObject 使用 ttl 时走 setEx', async () => {
    await RedisHelper.setObject('k2', { x: 2 }, 60);
    expect(redisMock.api.setEx._calls.length).toBe(1);
    const [key, ttl, val] = redisMock.api.setEx._calls[0];
    expect(key).toBe('testpfx:k2');
    expect(ttl).toBe(60);
    expect(JSON.parse(val)).toEqual({ x: 2 });
});

test('RedisHelper delObject 删除并返回 null', async () => {
    await RedisHelper.setObject('k3', { y: 3 });
    await RedisHelper.delObject('k3');
    const got = await RedisHelper.getObject('k3');
    expect(got).toBeNull();
});

test('RedisHelper genTimeID 返回数值且格式正确', async () => {
    const id1 = await RedisHelper.genTimeID();
    const id2 = await RedisHelper.genTimeID();
    expect(typeof id1).toBe('number');
    expect(typeof id2).toBe('number');
    // id2 不小于 id1（秒级+自增+随机，几乎总是 >=）
    expect(id2 >= id1).toBe(true);
});

// -------- Redis 插件连接测试 --------

test('Redis 插件在启用且 ping= PONG 时返回工具对象', async () => {
    const befly = {};
    const helper = await redisPlugin.onInit(befly);
    expect(typeof helper.setObject).toBe('function');
    expect(typeof helper.getObject).toBe('function');
    expect(typeof helper.delObject).toBe('function');
    expect(typeof helper.genTimeID).toBe('function');
});

test('Redis 插件在 ping 非 PONG 时抛出异常', async () => {
    // 暂时改写 ping 为失败
    const origPing = redisMock.api.ping;
    redisMock.api.ping = async () => 'ERR';

    let thrown = false;
    try {
        await redisPlugin.onInit({});
    } catch (e) {
        thrown = true;
    }
    expect(thrown).toBe(true);

    // 还原 ping
    redisMock.api.ping = origPing;
});
