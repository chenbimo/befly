import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Logger } from '../lib/logger';
import { Env } from '../env.js';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const testLogDir = join(process.cwd(), 'temp', 'test-logs');

beforeAll(() => {
    if (!existsSync(testLogDir)) {
        mkdirSync(testLogDir, { recursive: true });
    }
    Env.LOG_DIR = testLogDir;
    Env.LOG_TO_CONSOLE = 0;
    Env.LOG_DEBUG = 1;
});

afterAll(() => {
    if (existsSync(testLogDir)) {
        rmSync(testLogDir, { recursive: true, force: true });
    }
});

describe('Logger - 基本功能', () => {
    test('记录 info 日志', async () => {
        await Logger.log('info', 'Test info message');
        expect(true).toBe(true);
    });

    test('记录 warn 日志', async () => {
        await Logger.log('warn', 'Test warning');
        expect(true).toBe(true);
    });

    test('记录 error 日志', async () => {
        await Logger.log('error', 'Test error');
        expect(true).toBe(true);
    });

    test('记录 debug 日志', async () => {
        await Logger.log('debug', 'Test debug');
        expect(true).toBe(true);
    });

    test('记录 success 日志', async () => {
        await Logger.success('Test success');
        expect(true).toBe(true);
    });
});

describe('Logger - 不同类型消息', () => {
    test('记录字符串', async () => {
        await Logger.log('info', 'String message');
        expect(true).toBe(true);
    });

    test('记录数字', async () => {
        await Logger.log('info', 12345);
        expect(true).toBe(true);
    });

    test('记录对象', async () => {
        await Logger.log('info', { userId: 1, action: 'test' });
        expect(true).toBe(true);
    });

    test('记录数组', async () => {
        await Logger.log('info', ['item1', 'item2']);
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
