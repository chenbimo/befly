/**
 * DatabaseError 测试
 * 测试统一的数据库错误处理系统
 */

import { describe, expect, test } from 'bun:test';
import { DatabaseError, DBError, DB_ERROR_CODES } from '../utils/errors.js';

describe('DatabaseError 类测试', () => {
    test('创建基本错误', () => {
        const error = new DatabaseError('测试错误', DB_ERROR_CODES.QUERY_FAILED);

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.message).toBe('测试错误');
        expect(error.code).toBe(DB_ERROR_CODES.QUERY_FAILED);
        expect(error.name).toBe('DatabaseError');
    });

    test('创建带上下文的错误', () => {
        const context = { table: 'users', id: 123 };
        const error = new DatabaseError('查询失败', DB_ERROR_CODES.QUERY_FAILED, context);

        expect(error.context).toEqual(context);
        expect(error.context?.table).toBe('users');
        expect(error.context?.id).toBe(123);
    });

    test('创建带原始错误的错误', () => {
        const originalError = new Error('网络超时');
        const error = new DatabaseError('数据库连接失败', DB_ERROR_CODES.CONNECTION_FAILED, { host: 'localhost' }, originalError);

        expect(error.originalError).toBe(originalError);
        expect(error.originalError?.message).toBe('网络超时');
    });

    test('getFullMessage() 方法', () => {
        const error = new DatabaseError('查询失败', DB_ERROR_CODES.QUERY_FAILED, { table: 'users', sql: 'SELECT * FROM users' });

        const fullMessage = error.getFullMessage();
        expect(fullMessage).toContain('查询失败');
        expect(fullMessage).toContain('QUERY_FAILED');
        expect(fullMessage).toContain('table');
        expect(fullMessage).toContain('users');
    });

    test('toJSON() 方法', () => {
        const error = new DatabaseError('无效参数', DB_ERROR_CODES.INVALID_PARAMS, { field: 'email', value: null });

        const json = error.toJSON();
        expect(json.name).toBe('DatabaseError');
        expect(json.message).toBe('无效参数');
        expect(json.code).toBe(DB_ERROR_CODES.INVALID_PARAMS);
        expect(json.context).toEqual({ field: 'email', value: null });
    });

    test('toJSON() 包含原始错误信息', () => {
        const originalError = new Error('底层错误');
        const error = new DatabaseError('事务失败', DB_ERROR_CODES.TRANSACTION_COMMIT_FAILED, {}, originalError);

        const json = error.toJSON();
        expect(json.originalError).toBe('底层错误');
    });
});

describe('DBError 工厂方法测试', () => {
    test('connectionFailed()', () => {
        const error = DBError.connectionFailed('数据库连接超时', { host: 'localhost', port: 3306 });

        expect(error.code).toBe(DB_ERROR_CODES.CONNECTION_FAILED);
        expect(error.message).toBe('数据库连接超时');
        expect(error.context?.host).toBe('localhost');
    });

    test('idGenerationFailed()', () => {
        const originalError = new Error('Redis 不可用');
        const error = DBError.idGenerationFailed('生成 ID 失败', { table: 'users' }, originalError);

        expect(error.code).toBe(DB_ERROR_CODES.ID_GENERATION_FAILED);
        expect(error.originalError).toBe(originalError);
    });

    test('queryFailed()', () => {
        const error = DBError.queryFailed('SQL 执行失败', { sql: 'SELECT * FROM users', params: [] });

        expect(error.code).toBe(DB_ERROR_CODES.QUERY_FAILED);
        expect(error.context?.sql).toBe('SELECT * FROM users');
    });

    test('invalidParams()', () => {
        const error = DBError.invalidParams('缺少必填参数', { field: 'email', expected: 'string', got: 'undefined' });

        expect(error.code).toBe(DB_ERROR_CODES.INVALID_PARAMS);
        expect(error.message).toBe('缺少必填参数');
    });

    test('invalidTableName()', () => {
        const error = DBError.invalidTableName('user-table');

        expect(error.code).toBe(DB_ERROR_CODES.INVALID_TABLE_NAME);
        expect(error.message).toContain('user-table');
        expect(error.context?.tableName).toBe('user-table');
    });

    test('invalidFieldName()', () => {
        const error = DBError.invalidFieldName('user.email');

        expect(error.code).toBe(DB_ERROR_CODES.INVALID_FIELD_NAME);
        expect(error.message).toContain('user.email');
        expect(error.context?.fieldName).toBe('user.email');
    });

    test('dataNotFound()', () => {
        const error = DBError.dataNotFound('用户不存在', { table: 'users', id: 999 });

        expect(error.code).toBe(DB_ERROR_CODES.DATA_NOT_FOUND);
        expect(error.context?.id).toBe(999);
    });

    test('transactionCommitFailed()', () => {
        const originalError = new Error('锁超时');
        const error = DBError.transactionCommitFailed('提交事务失败', originalError);

        expect(error.code).toBe(DB_ERROR_CODES.TRANSACTION_COMMIT_FAILED);
        expect(error.originalError?.message).toBe('锁超时');
    });

    test('transactionRollbackFailed()', () => {
        const error = DBError.transactionRollbackFailed('回滚失败', { reason: '连接已断开' });

        expect(error.code).toBe(DB_ERROR_CODES.TRANSACTION_ROLLBACK_FAILED);
    });

    test('batchSizeExceeded()', () => {
        const error = DBError.batchSizeExceeded(1500, 1000);

        expect(error.code).toBe(DB_ERROR_CODES.BATCH_SIZE_EXCEEDED);
        expect(error.message).toContain('1500');
        expect(error.message).toContain('1000');
        expect(error.context?.actual).toBe(1500);
        expect(error.context?.max).toBe(1000);
    });

    test('batchInsertFailed()', () => {
        const originalError = new Error('字段类型不匹配');
        const error = DBError.batchInsertFailed('users', originalError);

        expect(error.code).toBe(DB_ERROR_CODES.BATCH_INSERT_FAILED);
        expect(error.message).toContain('users');
        expect(error.context?.table).toBe('users');
        expect(error.originalError).toBe(originalError);
    });
});

describe('DB_ERROR_CODES 常量测试', () => {
    test('所有错误码都存在', () => {
        expect(DB_ERROR_CODES.CONNECTION_FAILED).toBe('DB_CONNECTION_FAILED');
        expect(DB_ERROR_CODES.ID_GENERATION_FAILED).toBe('DB_ID_GENERATION_FAILED');
        expect(DB_ERROR_CODES.QUERY_FAILED).toBe('DB_QUERY_FAILED');
        expect(DB_ERROR_CODES.INVALID_PARAMS).toBe('DB_INVALID_PARAMS');
        expect(DB_ERROR_CODES.INVALID_TABLE_NAME).toBe('DB_INVALID_TABLE_NAME');
        expect(DB_ERROR_CODES.INVALID_FIELD_NAME).toBe('DB_INVALID_FIELD_NAME');
        expect(DB_ERROR_CODES.DATA_NOT_FOUND).toBe('DB_DATA_NOT_FOUND');
        expect(DB_ERROR_CODES.TRANSACTION_COMMIT_FAILED).toBe('DB_TRANSACTION_COMMIT_FAILED');
        expect(DB_ERROR_CODES.TRANSACTION_ROLLBACK_FAILED).toBe('DB_TRANSACTION_ROLLBACK_FAILED');
        expect(DB_ERROR_CODES.BATCH_SIZE_EXCEEDED).toBe('DB_BATCH_SIZE_EXCEEDED');
        expect(DB_ERROR_CODES.BATCH_INSERT_FAILED).toBe('DB_BATCH_INSERT_FAILED');
    });

    test('错误码常量的值正确', () => {
        // 验证错误码值的格式统一（都以 DB_ 开头）
        const codes = Object.values(DB_ERROR_CODES);
        codes.forEach((code) => {
            expect(code.startsWith('DB_')).toBe(true);
        });
    });
});

describe('实际使用场景测试', () => {
    test('捕获 DatabaseError 并提取信息', () => {
        try {
            throw DBError.queryFailed('查询超时', { table: 'users', timeout: 5000 });
        } catch (error: any) {
            expect(error).toBeInstanceOf(DatabaseError);
            expect(error.code).toBe(DB_ERROR_CODES.QUERY_FAILED);
            expect(error.context.table).toBe('users');

            // 可以访问完整信息
            const fullMessage = error.getFullMessage();
            expect(fullMessage).toContain('查询超时');
            expect(fullMessage).toContain('users');
        }
    });

    test('捕获嵌套的原始错误', () => {
        const rootCause = new Error('网络断开');

        try {
            throw DBError.connectionFailed('连接失败', { host: 'db.example.com' }, rootCause);
        } catch (error: any) {
            expect(error.originalError).toBe(rootCause);
            expect(error.originalError.message).toBe('网络断开');

            // JSON 序列化时包含原始错误信息
            const json = error.toJSON();
            expect(json.originalError).toBe('网络断开');
        }
    });

    test('错误信息可以被日志系统使用', () => {
        const error = DBError.batchSizeExceeded(2000, 1000);

        // 模拟日志记录
        const logEntry = {
            timestamp: Date.now(),
            level: 'error',
            ...error.toJSON()
        };

        expect(logEntry.code).toBe('DB_BATCH_SIZE_EXCEEDED');
        expect(logEntry.context.actual).toBe(2000);
        expect(logEntry.context.max).toBe(1000);
        expect(logEntry.message).toContain('2000');
        expect(logEntry.message).toContain('1000');
    });
});
