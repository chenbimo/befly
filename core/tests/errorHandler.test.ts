/**
 * ErrorHandler 测试
 */

import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';
import { ErrorHandler } from '../utils/errorHandler.js';
import { Logger } from '../utils/logger.js';

describe('ErrorHandler', () => {
    let mockExit: any;
    let mockLoggerError: any;
    let mockLoggerWarn: any;
    let mockLoggerInfo: any;

    beforeEach(() => {
        // Mock process.exit
        mockExit = spyOn(process, 'exit').mockImplementation((() => {
            throw new Error('process.exit called');
        }) as any);

        // Mock Logger methods
        mockLoggerError = spyOn(Logger, 'error').mockImplementation(async () => {});
        mockLoggerWarn = spyOn(Logger, 'warn').mockImplementation(async () => {});
        mockLoggerInfo = spyOn(Logger, 'info').mockImplementation(async () => {});
    });

    afterEach(() => {
        mockExit.mockRestore();
        mockLoggerError.mockRestore();
        mockLoggerWarn.mockRestore();
        mockLoggerInfo.mockRestore();
    });

    describe('critical', () => {
        test('应该记录错误并退出进程', () => {
            expect(() => {
                ErrorHandler.critical('测试致命错误');
            }).toThrow('process.exit called');

            expect(mockLoggerError).toHaveBeenCalledTimes(2);
            expect(mockExit).toHaveBeenCalledWith(1);
        });

        test('应该包含错误信息和元数据', () => {
            const testError = new Error('测试错误');
            const testMeta = { plugin: 'test-plugin' };

            try {
                ErrorHandler.critical('测试错误', testError, testMeta);
            } catch (e) {
                // process.exit 被 mock 会抛出错误
            }

            expect(mockLoggerError.mock.calls[0][0]).toMatchObject({
                level: 'CRITICAL',
                msg: '测试错误',
                error: '测试错误',
                plugin: 'test-plugin'
            });
        });
    });

    describe('warning', () => {
        test('应该记录警告但不退出进程', () => {
            ErrorHandler.warning('测试警告');

            expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
            expect(mockExit).not.toHaveBeenCalled();
        });

        test('应该包含错误信息和元数据', () => {
            const testError = new Error('测试错误');
            const testMeta = { api: 'test-api' };

            ErrorHandler.warning('测试警告', testError, testMeta);

            expect(mockLoggerWarn.mock.calls[0][0]).toMatchObject({
                level: 'WARNING',
                msg: '测试警告',
                error: '测试错误',
                api: 'test-api'
            });
        });
    });

    describe('info', () => {
        test('应该记录信息', () => {
            ErrorHandler.info('测试信息');

            expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
            expect(mockExit).not.toHaveBeenCalled();
        });

        test('应该包含元数据', () => {
            const testMeta = { count: 5, status: 'success' };

            ErrorHandler.info('测试信息', testMeta);

            expect(mockLoggerInfo.mock.calls[0][0]).toMatchObject({
                level: 'INFO',
                msg: '测试信息',
                count: 5,
                status: 'success'
            });
        });
    });
});
