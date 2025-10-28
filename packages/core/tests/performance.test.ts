/**
 * 性能测试套件
 */

import { describe, test, expect } from 'bun:test';
import { snakeCase } from 'es-toolkit/string';
import { whereKeysToSnake } from '../util.js';

describe('性能测试', () => {
    describe('snakeCase 性能', () => {
        test('单次转换性能', () => {
            const start = performance.now();
            for (let i = 0; i < 10000; i++) {
                snakeCase('userId');
                snakeCase('createdAt');
                snakeCase('userName');
                snakeCase('APIKey');
                snakeCase('HTTPRequest');
            }
            const duration = performance.now() - start;
            console.log(`snakeCase 50000次转换耗时: ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(100); // 应该在100ms内完成
        });

        test('批量转换性能', () => {
            const fields = ['userId', 'userName', 'userEmail', 'createdAt', 'updatedAt', 'APIKey', 'HTTPRequest', 'XMLParser'];
            const start = performance.now();
            for (let i = 0; i < 10000; i++) {
                fields.forEach((field) => snakeCase(field));
            }
            const duration = performance.now() - start;
            console.log(`snakeCase 80000次批量转换耗时: ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(200);
        });
    });

    describe('whereKeysToSnake 性能', () => {
        test('简单条件转换性能', () => {
            const where = { userId: 123, userName: 'John', userEmail: 'john@example.com' };
            const start = performance.now();
            for (let i = 0; i < 10000; i++) {
                whereKeysToSnake(where);
            }
            const duration = performance.now() - start;
            console.log(`whereKeysToSnake 简单条件10000次转换耗时: ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(100);
        });

        test('复杂条件转换性能', () => {
            const where = {
                userId$gt: 100,
                userName$like: '%John%',
                $or: [
                    { createdBy: 1, isActive: true },
                    { updatedBy: 2, isDeleted: false }
                ],
                $and: [{ userId$gte: 100 }, { userId$lte: 200 }]
            };
            const start = performance.now();
            for (let i = 0; i < 10000; i++) {
                whereKeysToSnake(where);
            }
            const duration = performance.now() - start;
            console.log(`whereKeysToSnake 复杂条件10000次转换耗时: ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(300);
        });

        test('深度嵌套条件转换性能', () => {
            const where = {
                userId: { $gt: 100, $lt: 200 },
                userName: 'John',
                $or: [
                    {
                        $and: [{ createdBy: 1 }, { isActive: true }]
                    },
                    {
                        $and: [{ updatedBy: 2 }, { isDeleted: false }]
                    }
                ]
            };
            const start = performance.now();
            for (let i = 0; i < 5000; i++) {
                whereKeysToSnake(where);
            }
            const duration = performance.now() - start;
            console.log(`whereKeysToSnake 深度嵌套5000次转换耗时: ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(200);
        });
    });

    describe('内存占用测试', () => {
        test('大量转换不应造成内存泄漏', () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // 执行大量转换
            for (let i = 0; i < 100000; i++) {
                snakeCase('userId');
                whereKeysToSnake({ userId: 123, userName: 'John' });
            }

            // 手动触发垃圾回收（如果可用）
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

            console.log(`内存增长: ${memoryIncrease.toFixed(2)}MB`);
            expect(memoryIncrease).toBeLessThan(50); // 内存增长应小于50MB
        });
    });

    describe('实际使用场景性能', () => {
        test('模拟数据库查询场景', () => {
            const queries = [
                { userId: 123 },
                { userId$gt: 100, userName$like: '%admin%' },
                { $or: [{ userId: 1 }, { userId: 2 }] },
                { userId: { $gte: 100, $lte: 200 } },
                {
                    userId$gt: 100,
                    $and: [{ isActive: true }, { isDeleted: false }]
                }
            ];

            const start = performance.now();
            for (let i = 0; i < 10000; i++) {
                queries.forEach((query) => whereKeysToSnake(query));
            }
            const duration = performance.now() - start;
            console.log(`模拟数据库查询50000次耗时: ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(500);
        });

        test('模拟 API 字段转换场景', () => {
            const fields = ['userId', 'userName', 'userEmail', 'createdAt', 'updatedAt', 'deletedAt', 'isActive', 'isDeleted', 'roleId'];

            const start = performance.now();
            for (let i = 0; i < 10000; i++) {
                const converted = fields.map((f) => snakeCase(f));
                // 模拟后续操作
                converted.forEach((f) => f.length);
            }
            const duration = performance.now() - start;
            console.log(`模拟 API 字段转换10000次耗时: ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(150);
        });
    });
});
