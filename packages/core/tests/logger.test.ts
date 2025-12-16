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

describe('Logger - 纯字符串消息', () => {
    test('info(msg)', () => {
        Logger.info('Test info message');
        expect(true).toBe(true);
    });

    test('warn(msg)', () => {
        Logger.warn('Test warning');
        expect(true).toBe(true);
    });

    test('error(msg)', () => {
        Logger.error('Test error');
        expect(true).toBe(true);
    });

    test('debug(msg)', () => {
        Logger.debug('Test debug');
        expect(true).toBe(true);
    });
});

describe('Logger - 对象 + 消息 (pino 原生格式)', () => {
    test('info(obj, msg)', () => {
        Logger.info({ userId: 1, action: 'login' }, 'User action');
        expect(true).toBe(true);
    });

    test('warn(obj, msg)', () => {
        Logger.warn({ ip: '127.0.0.1', count: 100 }, 'Rate limit warning');
        expect(true).toBe(true);
    });

    test('error(obj, msg)', () => {
        const err = new Error('Something went wrong');
        Logger.error({ err: err }, 'Request failed');
        expect(true).toBe(true);
    });

    test('debug(obj, msg)', () => {
        Logger.debug({ key: 'value', nested: { a: 1 } }, 'Debug data');
        expect(true).toBe(true);
    });
});

describe('Logger - 仅对象', () => {
    test('info(obj)', () => {
        Logger.info({ event: 'startup', port: 3000 });
        expect(true).toBe(true);
    });

    test('warn(obj)', () => {
        Logger.warn({ type: 'deprecation', feature: 'oldApi' });
        expect(true).toBe(true);
    });

    test('error(obj)', () => {
        Logger.error({ code: 500, message: 'Internal error' });
        expect(true).toBe(true);
    });

    test('debug(obj)', () => {
        Logger.debug({ query: 'SELECT * FROM users', duration: 15 });
        expect(true).toBe(true);
    });
});
