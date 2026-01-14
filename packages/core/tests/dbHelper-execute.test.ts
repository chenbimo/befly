/**
 * DbHelper executeWithConn 方法单元测试
 * 测试 SQL 执行、错误处理等功能
 */

import type { LoggerRecord, LoggerSink } from "../types/logger.ts";

import { test, expect, mock } from "bun:test";

import { DbHelper } from "../lib/dbHelper.ts";
import { Logger } from "../lib/logger.ts";

function isErrorWithSqlInfo(value: unknown): value is Error & { originalError: unknown; params: unknown; duration: unknown; sqlInfo: { sql: unknown; params: unknown } } {
    if (!(value instanceof Error)) {
        return false;
    }

    const record = value as Error & Record<string, unknown>;
    return "originalError" in record && "params" in record && "duration" in record && "sqlInfo" in record;
}

function createMockRedis() {
    return {
        get: mock(async () => null),
        set: mock(async () => true),
        del: mock(async () => 1),
        getObject: mock(async () => null),
        setObject: mock(async () => true),
        genTimeID: mock(async () => 1)
    };
}

test("executeWithConn - 正常执行（无参数）", async () => {
    const mockResult = [{ id: 1, name: "test" }];
    const sqlMock = {
        unsafe: mock(async () => mockResult)
    };

    const redis = createMockRedis();
    const dbHelper = new DbHelper({ redis: redis as any, sql: sqlMock });

    const result = await dbHelper.unsafe("SELECT * FROM users");

    expect(result.data).toEqual(mockResult);
    expect(result.sql.sql).toBe("SELECT * FROM users");
    expect(result.sql.params).toEqual([]);
    expect(typeof result.sql.duration).toBe("number");
    expect(sqlMock.unsafe).toHaveBeenCalledWith("SELECT * FROM users");
});

test("executeWithConn - 正常执行（带参数）", async () => {
    const mockResult = [{ id: 1, email: "test@example.com" }];
    const sqlMock = {
        unsafe: mock(async () => mockResult)
    };

    const redis = createMockRedis();
    const dbHelper = new DbHelper({ redis: redis as any, sql: sqlMock });

    const result = await dbHelper.unsafe("SELECT * FROM users WHERE id = ?", [1]);

    expect(result.data).toEqual(mockResult);
    expect(result.sql.sql).toBe("SELECT * FROM users WHERE id = ?");
    expect(result.sql.params).toEqual([1]);
    expect(typeof result.sql.duration).toBe("number");
    expect(sqlMock.unsafe).toHaveBeenCalledWith("SELECT * FROM users WHERE id = ?", [1]);
});

test("executeWithConn - SQL 错误捕获", async () => {
    const sqlError = new Error("You have an error in your SQL syntax");
    const sqlMock = {
        unsafe: mock(async () => {
            throw sqlError;
        })
    };

    const redis = createMockRedis();
    const dbHelper = new DbHelper({ redis: redis as any, sql: sqlMock });

    try {
        await dbHelper.unsafe("SELECT * FROM invalid_table");
        expect(true).toBe(false); // 不应该执行到这里
    } catch (error: unknown) {
        expect(isErrorWithSqlInfo(error)).toBe(true);
        if (!isErrorWithSqlInfo(error)) return;

        // 验证错误信息
        expect(error.message).toContain("SQL执行失败");
        expect(error.originalError).toBe(sqlError);
        expect(error.params).toEqual([]);
        expect(error.duration).toBeGreaterThanOrEqual(0);
        expect(error.sqlInfo).toBeTruthy();
        expect(error.sqlInfo.sql).toBe("SELECT * FROM invalid_table");
        expect(error.sqlInfo.params).toEqual([]);
    }
});

test("executeWithConn - DbHelper 不再全局打印 SQL 日志", async () => {
    const calls: Array<{ level: "info" | "warn" | "error" | "debug"; record: LoggerRecord }> = [];

    const loggerMock: LoggerSink = {
        info(record: LoggerRecord) {
            calls.push({ level: "info", record: record });
        },
        warn(record: LoggerRecord) {
            calls.push({ level: "warn", record: record });
        },
        error(record: LoggerRecord) {
            calls.push({ level: "error", record: record });
        },
        debug(record: LoggerRecord) {
            calls.push({ level: "debug", record: record });
        }
    };

    const sqlMock = {
        unsafe: mock(async () => {
            throw new Error("Test error");
        })
    };

    const redis = createMockRedis();
    const dbHelper = new DbHelper({ redis: redis as any, sql: sqlMock });

    Logger.setMock(loggerMock);
    try {
        await dbHelper.unsafe("SELECT * FROM invalid_table");
    } catch {
        // ignore
    }
    Logger.setMock(null);

    // executeWithConn 只负责抛错并在 error 上携带 sql 信息，不再做 Logger.error
    expect(calls.length).toBe(0);
});

test("executeWithConn - 错误信息包含完整信息", async () => {
    const sqlMock = {
        unsafe: mock(async () => {
            throw new Error('Syntax error near "??"');
        })
    };

    const redis = createMockRedis();
    const dbHelper = new DbHelper({ redis: redis as any, sql: sqlMock });

    const testSql = "SHOW COLUMNS FROM ??";
    const testParams = ["users"];

    try {
        await dbHelper.unsafe(testSql, testParams);
    } catch (error: unknown) {
        expect(isErrorWithSqlInfo(error)).toBe(true);
        if (!isErrorWithSqlInfo(error)) return;

        // 验证增强的错误对象
        expect(error.params).toEqual(testParams);
        expect(typeof error.duration).toBe("number");
        expect((error.originalError as Error).message).toBe('Syntax error near "??"');
        expect(error.sqlInfo.sql).toBe(testSql);
        expect(error.sqlInfo.params).toEqual(testParams);
    }
});

test("executeWithConn - 超长 SQL 保留在错误对象中", async () => {
    const longSql = "SELECT * FROM users WHERE " + "id = ? AND ".repeat(50) + "name = ?";
    const sqlMock = {
        unsafe: mock(async () => {
            throw new Error("Test error");
        })
    };

    const redis = createMockRedis();
    const dbHelper = new DbHelper({ redis: redis as any, sql: sqlMock });

    try {
        await dbHelper.unsafe(longSql);
    } catch (error: unknown) {
        expect(isErrorWithSqlInfo(error)).toBe(true);
        if (!isErrorWithSqlInfo(error)) return;

        // SQL 完整保存在错误对象中
        expect(error.params).toEqual([]);
        expect(error.sqlInfo.sql).toBe(longSql);
    }
});

test("executeWithConn - 慢查询仍返回 sql（不在 DbHelper 内部打日志）", async () => {
    const mockResult = [{ id: 1 }];
    const sqlMock = {
        unsafe: mock(async () => {
            // 模拟慢查询
            await new Promise((resolve) => setTimeout(resolve, 1100));
            return mockResult;
        })
    };

    const redis = createMockRedis();
    const dbHelper = new DbHelper({ redis: redis as any, sql: sqlMock });

    const result = await dbHelper.unsafe("SELECT SLEEP(1)");

    // 功能仍正常返回结果
    expect(result.data).toEqual(mockResult);
    expect(result.sql.sql).toBe("SELECT SLEEP(1)");
    expect(typeof result.sql.duration).toBe("number");
});

test("executeWithConn - 数据库未连接错误", async () => {
    const redis = createMockRedis();
    const dbHelper = new DbHelper({ redis: redis as any, sql: null }); // 没有 sql 实例

    try {
        await dbHelper.unsafe("SELECT * FROM users");
        expect(true).toBe(false); // 不应该执行到这里
    } catch (error: unknown) {
        expect(error instanceof Error).toBe(true);
        if (error instanceof Error) {
            expect(error.message).toBe("数据库连接未初始化");
        }
    }
});

test("executeWithConn - 空参数数组", async () => {
    const mockResult = [{ count: 10 }];
    const sqlMock = {
        unsafe: mock(async () => mockResult)
    };

    const redis = createMockRedis();
    const dbHelper = new DbHelper({ redis: redis as any, sql: sqlMock });

    const result = await dbHelper.unsafe("SELECT COUNT(*) as count FROM users", []);

    expect(result.data).toEqual(mockResult);
    // 空数组应该走 else 分支（不传参数）
    expect(sqlMock.unsafe).toHaveBeenCalledWith("SELECT COUNT(*) as count FROM users");
});

test("executeWithConn - 复杂参数处理", async () => {
    const sqlMock = {
        unsafe: mock(async () => {
            throw new Error("Test error");
        })
    };

    const redis = createMockRedis();
    const dbHelper = new DbHelper({ redis: redis as any, sql: sqlMock });

    const complexParams = [1, "test", { nested: "object" }, [1, 2, 3], null, undefined];
    const expectedParams = [1, "test", { nested: "object" }, [1, 2, 3], null, "undefined"];

    try {
        await dbHelper.unsafe("SELECT ?", complexParams);
    } catch (error: unknown) {
        expect(isErrorWithSqlInfo(error)).toBe(true);
        if (!isErrorWithSqlInfo(error)) return;

        // 验证参数被正确保存
        expect(error.params).toEqual(expectedParams);
        expect(error.sqlInfo.sql).toBe("SELECT ?");
    }
});
