/**
 * DbHelper executeWithConn 方法单元测试
 * 测试 SQL 执行、错误处理等功能
 */

import { test, expect, mock } from "bun:test";

import { DbHelper } from "../lib/dbHelper.js";

// 创建 Mock Befly 上下文
function createMockBefly() {
  return {
    redis: {
      get: mock(async () => null),
      set: mock(async () => true),
      del: mock(async () => 1),
    },
    db: null,
  };
}

test("executeWithConn - 正常执行（无参数）", async () => {
  const mockResult = [{ id: 1, name: "test" }];
  const sqlMock = {
    unsafe: mock(async () => mockResult),
  };

  const befly = createMockBefly();
  const dbHelper = new DbHelper(befly as any, sqlMock);

  // 使用反射访问私有方法
  const result = await (dbHelper as any).executeWithConn("SELECT * FROM users");

  expect(result).toEqual(mockResult);
  expect(sqlMock.unsafe).toHaveBeenCalledWith("SELECT * FROM users");
});

test("executeWithConn - 正常执行（带参数）", async () => {
  const mockResult = [{ id: 1, email: "test@example.com" }];
  const sqlMock = {
    unsafe: mock(async () => mockResult),
  };

  const befly = createMockBefly();
  const dbHelper = new DbHelper(befly as any, sqlMock);

  const result = await (dbHelper as any).executeWithConn("SELECT * FROM users WHERE id = ?", [1]);

  expect(result).toEqual(mockResult);
  expect(sqlMock.unsafe).toHaveBeenCalledWith("SELECT * FROM users WHERE id = ?", [1]);
});

test("executeWithConn - SQL 错误捕获", async () => {
  const sqlError = new Error("You have an error in your SQL syntax");
  const sqlMock = {
    unsafe: mock(async () => {
      throw sqlError;
    }),
  };

  const befly = createMockBefly();
  const dbHelper = new DbHelper(befly as any, sqlMock);

  try {
    await (dbHelper as any).executeWithConn("SELECT * FROM invalid_table");
    expect(true).toBe(false); // 不应该执行到这里
  } catch (error: any) {
    // 验证错误信息
    expect(error.message).toContain("SQL执行失败");
    expect(error.originalError).toBe(sqlError);
    expect(error.sql).toBe("SELECT * FROM invalid_table");
    expect(error.params).toEqual([]);
    expect(error.duration).toBeGreaterThanOrEqual(0);
  }
});

test("executeWithConn - 错误信息包含完整信息", async () => {
  const sqlMock = {
    unsafe: mock(async () => {
      throw new Error('Syntax error near "??"');
    }),
  };

  const befly = createMockBefly();
  const dbHelper = new DbHelper(befly as any, sqlMock);

  const testSql = "SHOW COLUMNS FROM ??";
  const testParams = ["users"];

  try {
    await (dbHelper as any).executeWithConn(testSql, testParams);
  } catch (error: any) {
    // 验证增强的错误对象
    expect(error.sql).toBe(testSql);
    expect(error.params).toEqual(testParams);
    expect(typeof error.duration).toBe("number");
    expect(error.originalError.message).toBe('Syntax error near "??"');
  }
});

test("executeWithConn - 超长 SQL 保留在错误对象中", async () => {
  const longSql = "SELECT * FROM users WHERE " + "id = ? AND ".repeat(50) + "name = ?";
  const sqlMock = {
    unsafe: mock(async () => {
      throw new Error("Test error");
    }),
  };

  const befly = createMockBefly();
  const dbHelper = new DbHelper(befly as any, sqlMock);

  try {
    await (dbHelper as any).executeWithConn(longSql);
  } catch (error: any) {
    // SQL 完整保存在错误对象中
    expect(error.sql).toBe(longSql);
    expect(error.params).toEqual([]);
  }
});

test("executeWithConn - 慢查询检测（>1000ms）", async () => {
  const mockResult = [{ id: 1 }];
  const sqlMock = {
    unsafe: mock(async () => {
      // 模拟慢查询
      await new Promise((resolve) => setTimeout(resolve, 1100));
      return mockResult;
    }),
  };

  const befly = createMockBefly();
  const dbHelper = new DbHelper(befly as any, sqlMock);

  const result = await (dbHelper as any).executeWithConn("SELECT SLEEP(1)");

  // 功能仍正常返回结果
  expect(result).toEqual(mockResult);
});

test("executeWithConn - 数据库未连接错误", async () => {
  const befly = createMockBefly(null);
  const dbHelper = new DbHelper(befly as any, null); // 没有 sql 实例

  try {
    await (dbHelper as any).executeWithConn("SELECT * FROM users");
    expect(true).toBe(false); // 不应该执行到这里
  } catch (error: any) {
    expect(error.message).toBe("数据库连接未初始化");
  }
});

test("executeWithConn - 空参数数组", async () => {
  const mockResult = [{ count: 10 }];
  const sqlMock = {
    unsafe: mock(async () => mockResult),
  };

  const befly = createMockBefly();
  const dbHelper = new DbHelper(befly as any, sqlMock);

  const result = await (dbHelper as any).executeWithConn("SELECT COUNT(*) as count FROM users", []);

  expect(result).toEqual(mockResult);
  // 空数组应该走 else 分支（不传参数）
  expect(sqlMock.unsafe).toHaveBeenCalledWith("SELECT COUNT(*) as count FROM users");
});

test("executeWithConn - 复杂参数处理", async () => {
  const sqlMock = {
    unsafe: mock(async () => {
      throw new Error("Test error");
    }),
  };

  const befly = createMockBefly();
  const dbHelper = new DbHelper(befly as any, sqlMock);

  const complexParams = [1, "test", { nested: "object" }, [1, 2, 3], null, undefined];

  try {
    await (dbHelper as any).executeWithConn("SELECT ?", complexParams);
  } catch (error: any) {
    // 验证参数被正确保存
    expect(error.params).toEqual(complexParams);
    expect(error.sql).toBe("SELECT ?");
  }
});
