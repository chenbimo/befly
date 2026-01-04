/**
 * DbHelper getTableColumns 方法单元测试
 * 测试表字段查询、Redis 缓存、SQL 语法修复等功能
 */

import { test, expect, mock } from "bun:test";

import { CacheKeys } from "../lib/cacheKeys.ts";
import { MySqlDialect } from "../lib/dbDialect.ts";
import { DbHelper } from "../lib/dbHelper.ts";

function createRedisMock(options?: { getObject?: any; setObject?: any; del?: any; genTimeID?: any }) {
    const getObject = options?.getObject ? options.getObject : mock(async () => null);
    const setObject = options?.setObject ? options.setObject : mock(async () => true);
    const del = options?.del ? options.del : mock(async () => 1);
    const genTimeID = options?.genTimeID ? options.genTimeID : mock(async () => 1);

    return {
        getObject: getObject,
        setObject: setObject,
        del: del,
        genTimeID: genTimeID
    };
}

test("getTableColumns - 正常查询表字段", async () => {
    const mockColumns = [{ Field: "id" }, { Field: "username" }, { Field: "email" }, { Field: "created_at" }];

    const sqlMock = {
        unsafe: mock(async (sql: string) => {
            // 验证 SQL 语法正确（使用反引号）
            expect(sql).toBe("SHOW COLUMNS FROM `users`");
            return mockColumns;
        })
    };

    const redisMock = createRedisMock({
        getObject: mock(async () => null) // 缓存未命中
    });

    const dbHelper = new DbHelper({ redis: redisMock as any, sql: sqlMock, dialect: new MySqlDialect() });

    const columns = await (dbHelper as any).getTableColumns("users");

    expect(columns).toEqual(["id", "username", "email", "created_at"]);
    expect(sqlMock.unsafe).toHaveBeenCalledTimes(1);
    expect(redisMock.getObject).toHaveBeenCalledWith(CacheKeys.tableColumns("users"));
    expect(redisMock.setObject).toHaveBeenCalled();
});

test("getTableColumns - Redis 缓存命中", async () => {
    const cachedColumns = ["id", "name", "email"];
    const redisMock = createRedisMock({
        getObject: mock(async () => cachedColumns)
    });

    const sqlMock = {
        unsafe: mock(async () => {
            throw new Error("不应该执行 SQL 查询");
        })
    };

    const dbHelper = new DbHelper({ redis: redisMock as any, sql: sqlMock, dialect: new MySqlDialect() });

    const columns = await (dbHelper as any).getTableColumns("users");

    expect(columns).toEqual(cachedColumns);
    expect(redisMock.getObject).toHaveBeenCalledWith(CacheKeys.tableColumns("users"));
    expect(sqlMock.unsafe).not.toHaveBeenCalled(); // SQL 不应该被调用
    expect(redisMock.setObject).not.toHaveBeenCalled(); // 不需要写缓存
});

test("getTableColumns - 表不存在错误", async () => {
    const sqlMock = {
        unsafe: mock(async () => []) // 返回空结果
    };

    const redisMock = createRedisMock();

    const dbHelper = new DbHelper({ redis: redisMock as any, sql: sqlMock, dialect: new MySqlDialect() });

    try {
        await (dbHelper as any).getTableColumns("non_existent_table");
        expect(true).toBe(false); // 不应该执行到这里
    } catch (error: any) {
        expect(error.message).toContain("表 non_existent_table 不存在或没有字段");
    }
});

test("getTableColumns - SQL 语法使用反引号", async () => {
    const mockColumns = [{ Field: "id" }];
    let capturedSql = "";

    const sqlMock = {
        unsafe: mock(async (sql: string) => {
            capturedSql = sql;
            return mockColumns;
        })
    };

    const dbHelper = new DbHelper({ redis: createRedisMock() as any, sql: sqlMock, dialect: new MySqlDialect() });

    await (dbHelper as any).getTableColumns("addon_admin_user");

    // 验证 SQL 语法
    expect(capturedSql).toBe("SHOW COLUMNS FROM `addon_admin_user`");
    expect(capturedSql).not.toContain("??"); // 不应该包含占位符
    expect(capturedSql).toContain("`"); // 应该使用反引号
});

test("getTableColumns - 表名特殊字符处理", async () => {
    const mockColumns = [{ Field: "id" }];
    const sqlMock = {
        unsafe: mock(async () => mockColumns)
    };

    const dbHelper = new DbHelper({ redis: createRedisMock() as any, sql: sqlMock, dialect: new MySqlDialect() });

    // 测试下划线表名
    await (dbHelper as any).getTableColumns("addon_admin_user");
    expect(sqlMock.unsafe).toHaveBeenLastCalledWith("SHOW COLUMNS FROM `addon_admin_user`");

    // 测试普通表名
    await (dbHelper as any).getTableColumns("users");
    expect(sqlMock.unsafe).toHaveBeenLastCalledWith("SHOW COLUMNS FROM `users`");
});

test("getTableColumns - 缓存键格式正确", async () => {
    const mockColumns = [{ Field: "id" }];
    const sqlMock = {
        unsafe: mock(async () => mockColumns)
    };

    const redisMock = createRedisMock({
        getObject: mock(async () => null),
        setObject: mock(async (key: string, value: any, seconds: number) => {
            // 验证缓存键格式
            expect(key).toBe(CacheKeys.tableColumns("test_table"));
            // 验证缓存值格式
            expect(Array.isArray(value)).toBe(true);
            // 验证过期时间
            expect(seconds).toBe(3600); // 1 小时
            return true;
        })
    });

    const dbHelper = new DbHelper({ redis: redisMock as any, sql: sqlMock, dialect: new MySqlDialect() });

    await (dbHelper as any).getTableColumns("test_table");

    expect(redisMock.setObject).toHaveBeenCalled();
});

test("getTableColumns - 多次调用相同表（缓存效果）", async () => {
    const mockColumns = [{ Field: "id" }, { Field: "name" }];
    let sqlCallCount = 0;

    const sqlMock = {
        unsafe: mock(async () => {
            sqlCallCount++;
            return mockColumns;
        })
    };

    const cache: Record<string, any> = {};
    const redisMock = createRedisMock({
        getObject: mock(async (key: string) => cache[key] || null),
        setObject: mock(async (key: string, value: any) => {
            cache[key] = value;
            return true;
        })
    });

    const dbHelper = new DbHelper({ redis: redisMock as any, sql: sqlMock, dialect: new MySqlDialect() });

    // 第一次调用 - 应该查询数据库
    const columns1 = await (dbHelper as any).getTableColumns("users");
    expect(columns1).toEqual(["id", "name"]);
    expect(sqlCallCount).toBe(1);

    // 第二次调用 - 应该从缓存读取
    const columns2 = await (dbHelper as any).getTableColumns("users");
    expect(columns2).toEqual(["id", "name"]);
    expect(sqlCallCount).toBe(1); // SQL 调用次数不变

    // 第三次调用 - 仍然从缓存读取
    const columns3 = await (dbHelper as any).getTableColumns("users");
    expect(columns3).toEqual(["id", "name"]);
    expect(sqlCallCount).toBe(1);
});

test("getTableColumns - Redis 错误处理", async () => {
    const mockColumns = [{ Field: "id" }];
    const sqlMock = {
        unsafe: mock(async () => mockColumns)
    };

    const redisMock = createRedisMock({
        getObject: mock(async () => {
            throw new Error("Redis 连接失败");
        })
    });

    const dbHelper = new DbHelper({ redis: redisMock as any, sql: sqlMock, dialect: new MySqlDialect() });

    try {
        await (dbHelper as any).getTableColumns("users");
        expect(true).toBe(false); // 不应该执行到这里
    } catch (error: any) {
        expect(error.message).toContain("Redis 连接失败");
    }
});

test("getTableColumns - 字段映射正确性", async () => {
    const mockColumns = [
        { Field: "id", Type: "int" },
        { Field: "user_name", Type: "varchar" },
        { Field: "created_at", Type: "timestamp" },
        { Field: "is_active", Type: "tinyint" }
    ];

    const sqlMock = {
        unsafe: mock(async () => mockColumns)
    };

    const dbHelper = new DbHelper({ redis: createRedisMock() as any, sql: sqlMock, dialect: new MySqlDialect() });

    const columns = await (dbHelper as any).getTableColumns("users");

    // 验证只提取 Field 字段
    expect(columns).toEqual(["id", "user_name", "created_at", "is_active"]);
    expect(columns.length).toBe(4);
    expect(columns.every((col: string) => typeof col === "string")).toBe(true);
});
