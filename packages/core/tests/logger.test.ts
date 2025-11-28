import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { Logger } from '../lib/logger';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const testLogDir = join(process.cwd(), 'temp', 'test-logs');

beforeAll(() => {
    if (!existsSync(testLogDir)) {
        mkdirSync(testLogDir, { recursive: true });
    }
    Logger.configure({
        dir: testLogDir,
        console: 0,
        debug: 1
    });
});

afterAll(async () => {
    // 延迟清理，等待 pino-roll 完成写入
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (existsSync(testLogDir)) {
        rmSync(testLogDir, { recursive: true, force: true });
    }
});

describe('Logger - 基本功能', () => {
    test('记录 info 日志', () => {
        Logger.info('Test info message');
        expect(true).toBe(true);
    });

    test('记录 warn 日志', () => {
        Logger.warn('Test warning');
        expect(true).toBe(true);
    });

    test('记录 error 日志', () => {
        Logger.error('Test error');
        expect(true).toBe(true);
    });

    test('记录 debug 日志', () => {
        Logger.debug('Test debug');
        expect(true).toBe(true);
    });

    test('记录 success 日志', () => {
        Logger.success('Test success');
        expect(true).toBe(true);
    });
});

describe('Logger - 带对象参数', () => {
    test('info 带对象', () => {
        Logger.info('User action', { userId: 1, action: 'login' });
        expect(true).toBe(true);
    });

    test('warn 带对象', () => {
        Logger.warn('Rate limit warning', { ip: '127.0.0.1', count: 100 });
        expect(true).toBe(true);
    });

    test('error 带 Error 对象', () => {
        const err = new Error('Something went wrong');
        Logger.error('Request failed', err);
        expect(true).toBe(true);
    });

    test('debug 带对象', () => {
        Logger.debug('Debug data', { key: 'value', nested: { a: 1 } });
        expect(true).toBe(true);
    });
});

describe('Logger - 便捷方法', () => {
    test('info 方法', () => {
        Logger.info('Info test');
        expect(true).toBe(true);
    });

    test('warn 方法', () => {
        Logger.warn('Warn test');
        expect(true).toBe(true);
    });

    test('error 方法', () => {
        Logger.error('Error test');
        expect(true).toBe(true);
    });

    test('debug 方法', () => {
        Logger.debug('Debug test');
        expect(true).toBe(true);
    });
});

describe('Logger - 字符串拼接兼容', () => {
    test('warn 带字符串参数', () => {
        Logger.warn('⚠️ 缓存异常:', 'Connection refused');
        expect(true).toBe(true);
    });

    test('error 带字符串参数', () => {
        Logger.error('SQL 执行失败', 'Table not found');
        expect(true).toBe(true);
    });

    test('info 带字符串参数', () => {
        Logger.info('用户登录:', 'admin');
        expect(true).toBe(true);
    });

    test('debug 带字符串参数', () => {
        Logger.debug('当前状态:', 'running');
        expect(true).toBe(true);
    });
});
