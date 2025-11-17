/**
 * DbHelper executeWithConn 方法单元测试
 * 测试 SQL 执行、错误处理、慢查询日志等功能
 */

import { test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { DbHelper } from '../lib/dbHelper.js';
import { Logger } from '../lib/logger.js';

// Mock Logger
const originalLoggerError = Logger.error;
const originalLoggerWarn = Logger.warn;
let errorLogs: string[] = [];
let warnLogs: string[] = [];

beforeEach(() => {
    errorLogs = [];
    warnLogs = [];
    Logger.error = mock((msg: string) => {
        errorLogs.push(msg);
    });
    Logger.warn = mock((msg: string) => {
        warnLogs.push(msg);
    });
});

afterEach(() => {
    Logger.error = originalLoggerError;
    Logger.warn = originalLoggerWarn;
});

// 创建 Mock Befly 上下文
function createMockBefly(sqlMock: any) {
    return {
        redis: {
            get: mock(async () => null),
            set: mock(async () => true),
            del: mock(async () => 1)
        },
        db: null
    };
}

test('executeWithConn - 正常执行（无参数）', async () => {
    const mockResult = [{ id: 1, name: 'test' }];
    const sqlMock = {
        unsafe: mock(async () => mockResult)
    };

    const befly = createMockBefly(sqlMock);
    const dbHelper = new DbHelper(befly as any, sqlMock);

    // 使用反射访问私有方法
    const result = await (dbHelper as any).executeWithConn('SELECT * FROM users');

    expect(result).toEqual(mockResult);
    expect(sqlMock.unsafe).toHaveBeenCalledWith('SELECT * FROM users');
    expect(errorLogs.length).toBe(0);
});

test('executeWithConn - 正常执行（带参数）', async () => {
    const mockResult = [{ id: 1, email: 'test@example.com' }];
    const sqlMock = {
        unsafe: mock(async () => mockResult)
    };

    const befly = createMockBefly(sqlMock);
    const dbHelper = new DbHelper(befly as any, sqlMock);

    const result = await (dbHelper as any).executeWithConn('SELECT * FROM users WHERE id = ?', [1]);

    expect(result).toEqual(mockResult);
    expect(sqlMock.unsafe).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
    expect(errorLogs.length).toBe(0);
});

test('executeWithConn - SQL 错误捕获', async () => {
    const sqlError = new Error('You have an error in your SQL syntax');
    const sqlMock = {
        unsafe: mock(async () => {
            throw sqlError;
        })
    };

    const befly = createMockBefly(sqlMock);
    const dbHelper = new DbHelper(befly as any, sqlMock);

    try {
        await (dbHelper as any).executeWithConn('SELECT * FROM invalid_table');
        expect(true).toBe(false); // 不应该执行到这里
    } catch (error: any) {
        // 验证错误信息
        expect(error.message).toContain('SQL执行失败');
        expect(error.originalError).toBe(sqlError);
        expect(error.sql).toBe('SELECT * FROM invalid_table');
        expect(error.params).toEqual([]);
        expect(error.duration).toBeGreaterThanOrEqual(0);

        // 验证错误日志
        expect(errorLogs.length).toBeGreaterThan(0);
        expect(errorLogs.some((log) => log.includes('SQL 执行错误'))).toBe(true);
        expect(errorLogs.some((log) => log.includes('SELECT * FROM invalid_table'))).toBe(true);
        expect(errorLogs.some((log) => log.includes('You have an error in your SQL syntax'))).toBe(true);
    }
});

test('executeWithConn - 错误日志包含完整信息', async () => {
    const sqlMock = {
        unsafe: mock(async () => {
            throw new Error('Syntax error near "??"');
        })
    };

    const befly = createMockBefly(sqlMock);
    const dbHelper = new DbHelper(befly as any, sqlMock);

    const testSql = 'SHOW COLUMNS FROM ??';
    const testParams = ['users'];

    try {
        await (dbHelper as any).executeWithConn(testSql, testParams);
    } catch (error: any) {
        // 验证增强的错误对象
        expect(error.sql).toBe(testSql);
        expect(error.params).toEqual(testParams);
        expect(typeof error.duration).toBe('number');

        // 验证日志内容
        const allLogs = errorLogs.join('\n');
        expect(allLogs).toContain('SQL 语句:');
        expect(allLogs).toContain('SHOW COLUMNS FROM ??');
        expect(allLogs).toContain('参数列表:');
        expect(allLogs).toContain('["users"]');
        expect(allLogs).toContain('执行耗时:');
        expect(allLogs).toContain('错误信息:');
        expect(allLogs).toContain('Syntax error near "??"');
    }
});

test('executeWithConn - 超长 SQL 截断', async () => {
    const longSql = 'SELECT * FROM users WHERE ' + 'id = ? AND '.repeat(50) + 'name = ?';
    const sqlMock = {
        unsafe: mock(async () => {
            throw new Error('Test error');
        })
    };

    const befly = createMockBefly(sqlMock);
    const dbHelper = new DbHelper(befly as any, sqlMock);

    try {
        await (dbHelper as any).executeWithConn(longSql);
    } catch (error: any) {
        // SQL 应该被截断
        expect(error.sql).toBe(longSql); // 完整保存在错误对象中

        // 日志中应该截断并加 ...
        const sqlLog = errorLogs.find((log) => log.includes('SQL 语句:'));
        expect(sqlLog).toBeDefined();
        if (sqlLog) {
            expect(sqlLog.length).toBeLessThan(longSql.length + 50); // 截断后应该更短
            expect(sqlLog).toContain('...');
        }
    }
});

test('executeWithConn - 慢查询日志（>1000ms）', async () => {
    const mockResult = [{ id: 1 }];
    const sqlMock = {
        unsafe: mock(async () => {
            // 模拟慢查询
            await new Promise((resolve) => setTimeout(resolve, 1100));
            return mockResult;
        })
    };

    const befly = createMockBefly(sqlMock);
    const dbHelper = new DbHelper(befly as any, sqlMock);

    const result = await (dbHelper as any).executeWithConn('SELECT SLEEP(1)');

    expect(result).toEqual(mockResult);
    expect(warnLogs.length).toBeGreaterThan(0);
    expect(warnLogs.some((log) => log.includes('🐌 检测到慢查询'))).toBe(true);
    expect(warnLogs.some((log) => log.includes('ms'))).toBe(true);
});

test('executeWithConn - 数据库未连接错误', async () => {
    const befly = createMockBefly(null);
    const dbHelper = new DbHelper(befly as any, null); // 没有 sql 实例

    try {
        await (dbHelper as any).executeWithConn('SELECT * FROM users');
        expect(true).toBe(false); // 不应该执行到这里
    } catch (error: any) {
        expect(error.message).toBe('数据库连接未初始化');
    }
});

test('executeWithConn - 空参数数组', async () => {
    const mockResult = [{ count: 10 }];
    const sqlMock = {
        unsafe: mock(async () => mockResult)
    };

    const befly = createMockBefly(sqlMock);
    const dbHelper = new DbHelper(befly as any, sqlMock);

    const result = await (dbHelper as any).executeWithConn('SELECT COUNT(*) as count FROM users', []);

    expect(result).toEqual(mockResult);
    // 空数组应该走 else 分支（不传参数）
    expect(sqlMock.unsafe).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM users');
});

test('executeWithConn - 参数 JSON 序列化', async () => {
    const sqlMock = {
        unsafe: mock(async () => {
            throw new Error('Test error');
        })
    };

    const befly = createMockBefly(sqlMock);
    const dbHelper = new DbHelper(befly as any, sqlMock);

    const complexParams = [1, 'test', { nested: 'object' }, [1, 2, 3], null, undefined];

    try {
        await (dbHelper as any).executeWithConn('SELECT ?', complexParams);
    } catch (error: any) {
        // 验证参数被正确序列化
        const paramsLog = errorLogs.find((log) => log.includes('参数列表:'));
        expect(paramsLog).toBeDefined();
        if (paramsLog) {
            // JSON.stringify 应该能处理复杂参数
            expect(paramsLog).toContain('参数列表:');
            expect(() => JSON.parse(paramsLog.split('参数列表:')[1].trim())).not.toThrow();
        }
    }
});
