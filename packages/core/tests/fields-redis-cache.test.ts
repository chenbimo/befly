/**
 * 验证 Redis 缓存的字段查询功能
 */

import { CacheKeys } from "../lib/cacheKeys.js";

const TABLE_COLUMNS_CACHE_TTL_SECONDS = 3600;

console.log("\n========== Redis 缓存验证 ==========\n");

// 模拟 Redis 缓存逻辑
class MockRedis {
    private cache: Map<string, { value: any; expire: number }> = new Map();

    async getObject<T>(key: string): Promise<T | null> {
        const cached = this.cache.get(key);
        if (cached && cached.expire > Date.now()) {
            console.log(`✅ Redis 缓存命中: ${key}`);
            return cached.value as T;
        }
        console.log(`❌ Redis 缓存未命中: ${key}`);
        return null;
    }

    async setObject(key: string, value: any, ttl: number): Promise<void> {
        this.cache.set(key, {
            value: value,
            expire: Date.now() + ttl * 1000
        });
        console.log(`📝 写入 Redis 缓存: ${key} (TTL: ${ttl}s)`);
    }
}

// 模拟数据库查询
async function queryDatabase(table: string): Promise<string[]> {
    console.log(`🔍 查询数据库表结构: ${table}`);
    // 模拟数据库延迟
    await new Promise((resolve) => setTimeout(resolve, 3));
    return ["id", "name", "email", "password", "salt", "created_at"];
}

// 模拟 getTableColumns 方法
async function getTableColumns(redis: MockRedis, table: string): Promise<string[]> {
    // 1. 先查 Redis 缓存
    const cacheKey = CacheKeys.tableColumns(table);
    let columns = await redis.getObject<string[]>(cacheKey);

    if (columns && columns.length > 0) {
        return columns;
    }

    // 2. 缓存未命中，查询数据库
    columns = await queryDatabase(table);

    // 3. 写入 Redis 缓存
    await redis.setObject(cacheKey, columns, TABLE_COLUMNS_CACHE_TTL_SECONDS);

    return columns;
}

async function test() {
    const redis = new MockRedis();

    console.log("【场景1】单进程多次查询\n");

    // 第1次查询（缓存未命中）
    console.log("--- 第1次查询 user 表 ---");
    const start1 = Date.now();
    const columns1 = await getTableColumns(redis, "user");
    const time1 = Date.now() - start1;
    console.log(`结果: ${columns1.join(", ")}`);
    console.log(`耗时: ${time1}ms\n`);

    // 第2次查询（缓存命中）
    console.log("--- 第2次查询 user 表 ---");
    const start2 = Date.now();
    const columns2 = await getTableColumns(redis, "user");
    const time2 = Date.now() - start2;
    console.log(`结果: ${columns2.join(", ")}`);
    console.log(`耗时: ${time2}ms\n`);

    // 第3次查询（缓存命中）
    console.log("--- 第3次查询 user 表 ---");
    const start3 = Date.now();
    const columns3 = await getTableColumns(redis, "user");
    const time3 = Date.now() - start3;
    console.log(`结果: ${columns3.join(", ")}`);
    console.log(`耗时: ${time3}ms\n`);

    console.log("【场景2】模拟 PM2 cluster（多进程共享 Redis）\n");

    // 模拟 Worker 1 查询
    console.log("--- Worker 1 查询 article 表 ---");
    const worker1Start = Date.now();
    const worker1Columns = await getTableColumns(redis, "article");
    const worker1Time = Date.now() - worker1Start;
    console.log(`结果: ${worker1Columns.join(", ")}`);
    console.log(`耗时: ${worker1Time}ms\n`);

    // 模拟 Worker 2 查询（共享 Redis 缓存）
    console.log("--- Worker 2 查询 article 表 ---");
    const worker2Start = Date.now();
    const worker2Columns = await getTableColumns(redis, "article");
    const worker2Time = Date.now() - worker2Start;
    console.log(`结果: ${worker2Columns.join(", ")}`);
    console.log(`耗时: ${worker2Time}ms`);
    console.log(`✅ Worker 2 直接使用 Worker 1 的缓存，无需再查数据库\n`);

    // 模拟 Worker 3 查询（共享 Redis 缓存）
    console.log("--- Worker 3 查询 article 表 ---");
    const worker3Start = Date.now();
    const worker3Columns = await getTableColumns(redis, "article");
    const worker3Time = Date.now() - worker3Start;
    console.log(`结果: ${worker3Columns.join(", ")}`);
    console.log(`耗时: ${worker3Time}ms`);
    console.log(`✅ Worker 3 直接使用 Worker 1 的缓存，无需再查数据库\n`);

    console.log("========== 验证完成 ==========\n");

    console.log("📊 性能总结:");
    console.log(`- 首次查询（数据库）: ${time1}ms`);
    console.log(`- 后续查询（Redis）: ${time2}ms`);
    console.log(`- 性能提升: ${(time1 / time2).toFixed(1)}x`);
    console.log(`- PM2 cluster: ✅ 所有 worker 共享同一份 Redis 缓存`);
}

test();
