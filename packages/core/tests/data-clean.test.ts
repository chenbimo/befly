/**
 * 数据清洗函数测试
 */

import { describe, it, expect } from 'bun:test';
import { cleanData } from '../util.js';

describe('cleanData - 数据清洗', () => {
    describe('基础功能', () => {
        it('应该返回完整对象（无选项）', () => {
            const data = { a: 1, b: 2, c: 3 };
            const result = cleanData(data);
            expect(result).toEqual({ a: 1, b: 2, c: 3 });
        });

        it('应该处理空对象', () => {
            const result = cleanData({});
            expect(result).toEqual({});
        });

        it('应该处理非对象输入', () => {
            expect(cleanData(null as any)).toBe(null);
            expect(cleanData(undefined as any)).toBeUndefined();
            expect(cleanData(123 as any)).toBe(123);
            expect(cleanData('string' as any)).toBe('string');
        });
    });

    describe('excludeKeys - 排除指定字段', () => {
        it('应该排除单个字段', () => {
            const data = { a: 1, b: 2, c: 3 };
            const result = cleanData(data, { excludeKeys: ['b'] });
            expect(result).toEqual({ a: 1, c: 3 });
        });

        it('应该排除多个字段', () => {
            const data = { a: 1, b: 2, c: 3, d: 4 };
            const result = cleanData(data, { excludeKeys: ['b', 'd'] });
            expect(result).toEqual({ a: 1, c: 3 });
        });

        it('应该排除不存在的字段（不报错）', () => {
            const data = { a: 1, b: 2 };
            const result = cleanData(data, { excludeKeys: ['x', 'y'] });
            expect(result).toEqual({ a: 1, b: 2 });
        });
    });

    describe('includeKeys - 只包含指定字段', () => {
        it('应该只包含单个字段', () => {
            const data = { a: 1, b: 2, c: 3 };
            const result = cleanData(data, { includeKeys: ['a'] });
            expect(result).toEqual({ a: 1 });
        });

        it('应该只包含多个字段', () => {
            const data = { a: 1, b: 2, c: 3, d: 4 };
            const result = cleanData(data, { includeKeys: ['a', 'c'] });
            expect(result).toEqual({ a: 1, c: 3 });
        });

        it('includeKeys 优先级高于 excludeKeys', () => {
            const data = { a: 1, b: 2, c: 3 };
            const result = cleanData(data, {
                includeKeys: ['a', 'b'],
                excludeKeys: ['b'] // 应该被忽略
            });
            expect(result).toEqual({ a: 1, b: 2 });
        });

        it('应该处理不存在的 includeKeys', () => {
            const data = { a: 1, b: 2 };
            const result = cleanData(data, { includeKeys: ['x', 'y'] });
            expect(result).toEqual({});
        });
    });

    describe('removeValues - 移除指定值', () => {
        it('应该移除 null 值', () => {
            const data = { a: 1, b: null, c: 3 };
            const result = cleanData(data, { removeValues: [null] });
            expect(result).toEqual({ a: 1, c: 3 });
        });

        it('应该移除 undefined 值', () => {
            const data = { a: 1, b: undefined, c: 3 };
            const result = cleanData(data, { removeValues: [undefined] });
            expect(result).toEqual({ a: 1, c: 3 });
        });

        it('应该移除空字符串', () => {
            const data = { a: 1, b: '', c: 3 };
            const result = cleanData(data, { removeValues: [''] });
            expect(result).toEqual({ a: 1, c: 3 });
        });

        it('应该移除多个指定值', () => {
            const data = { a: 1, b: null, c: undefined, d: '', e: 0, f: 5 };
            const result = cleanData(data, { removeValues: [null, undefined, '', 0] });
            expect(result).toEqual({ a: 1, f: 5 });
        });

        it('应该移除 NaN 值', () => {
            const data = { a: 1, b: NaN, c: 3 };
            const result = cleanData(data, { removeValues: [NaN] });
            expect(result).toEqual({ a: 1, c: 3 });
        });

        it('默认移除 null 和 undefined', () => {
            const data = { a: 1, b: null, c: undefined, d: '' };
            const result = cleanData(data); // 默认 removeValues: [null, undefined]
            expect(result).toEqual({ a: 1, d: '' });
        });
    });

    describe('maxLen - 限制字段值长度', () => {
        it('应该截断字符串', () => {
            const data = { text: 'A'.repeat(1000) };
            const result = cleanData(data, { maxLen: 10 });
            expect(result.text).toBe('A'.repeat(10));
        });

        it('应该保留短字符串', () => {
            const data = { text: 'hello' };
            const result = cleanData(data, { maxLen: 10 });
            expect(result.text).toBe('hello');
        });

        it('应该截断 JSON 字符串化的对象', () => {
            const data = { obj: { name: 'A'.repeat(1000) } };
            const result = cleanData(data, { maxLen: 20 });
            expect(result.obj.length).toBe(20);
        });

        it('应该截断 JSON 字符串化的数组', () => {
            const data = { arr: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
            const result = cleanData(data, { maxLen: 10 });
            expect(result.arr.length).toBe(10);
        });

        it('maxLen 为 0 时不截断', () => {
            const data = { text: 'A'.repeat(1000) };
            const result = cleanData(data, { maxLen: 0 });
            expect(result.text.length).toBe(1000);
        });
    });

    describe('deep - 深度清洗', () => {
        it('应该深度清洗嵌套对象', () => {
            const data = {
                user: {
                    name: 'John',
                    password: '123456',
                    profile: {
                        age: 30,
                        secret: 'xxx'
                    }
                }
            };
            const result = cleanData(data, {
                excludeKeys: ['password', 'secret'],
                deep: true
            });
            expect(result).toEqual({
                user: {
                    name: 'John',
                    profile: {
                        age: 30
                    }
                }
            });
        });

        it('应该深度清洗数组对象', () => {
            const data = {
                users: [
                    { name: 'John', password: '123' },
                    { name: 'Jane', password: '456' }
                ]
            };
            const result = cleanData(data, {
                excludeKeys: ['password'],
                deep: true
            });
            expect(result).toEqual({
                users: [{ name: 'John' }, { name: 'Jane' }]
            });
        });

        it('应该深度移除指定值', () => {
            const data = {
                level1: {
                    a: 1,
                    b: null,
                    level2: {
                        c: 2,
                        d: null
                    }
                }
            };
            const result = cleanData(data, {
                removeValues: [null],
                deep: true
            });
            expect(result).toEqual({
                level1: {
                    a: 1,
                    level2: {
                        c: 2
                    }
                }
            });
        });

        it('应该深度限制长度', () => {
            const data = {
                level1: {
                    text: 'A'.repeat(100),
                    level2: {
                        text: 'B'.repeat(100)
                    }
                }
            };
            const result = cleanData(data, {
                maxLen: 10,
                deep: true
            });
            expect(result.level1.text).toBe('A'.repeat(10));
            expect(result.level1.level2.text).toBe('B'.repeat(10));
        });

        it('deep 为 false 时不处理嵌套对象', () => {
            const data = {
                user: {
                    name: 'John',
                    password: '123456'
                }
            };
            const result = cleanData(data, {
                excludeKeys: ['password'],
                deep: false
            });
            expect(result.user).toEqual({
                name: 'John',
                password: '123456'
            });
        });
    });

    describe('组合使用', () => {
        it('应该组合 excludeKeys + removeValues', () => {
            const data = { a: 1, b: null, c: 3, d: 4 };
            const result = cleanData(data, {
                excludeKeys: ['d'],
                removeValues: [null]
            });
            expect(result).toEqual({ a: 1, c: 3 });
        });

        it('应该组合 includeKeys + removeValues', () => {
            const data = { a: 1, b: null, c: 3 };
            const result = cleanData(data, {
                includeKeys: ['a', 'b', 'c'],
                removeValues: [null]
            });
            expect(result).toEqual({ a: 1, c: 3 });
        });

        it('应该组合 excludeKeys + maxLen', () => {
            const data = {
                a: 'A'.repeat(100),
                b: 'B'.repeat(100),
                c: 'C'.repeat(100)
            };
            const result = cleanData(data, {
                excludeKeys: ['b'],
                maxLen: 10
            });
            expect(result).toEqual({
                a: 'A'.repeat(10),
                c: 'C'.repeat(10)
            });
        });

        it('应该组合所有选项', () => {
            const data = {
                user: {
                    name: 'John',
                    password: 'A'.repeat(100),
                    email: null,
                    age: 30
                },
                admin: {
                    name: 'Admin',
                    secret: 'xxx'
                }
            };
            const result = cleanData(data, {
                excludeKeys: ['password', 'secret'],
                removeValues: [null],
                maxLen: 20,
                deep: true
            });
            expect(result).toEqual({
                user: {
                    name: 'John',
                    age: 30
                },
                admin: {
                    name: 'Admin'
                }
            });
        });
    });

    describe('实际场景', () => {
        it('清洗用户数据（移除敏感信息）', () => {
            const userData = {
                id: 1,
                name: 'John',
                email: 'john@example.com',
                password: 'hashed_password',
                token: 'secret_token',
                age: 30
            };
            const result = cleanData(userData, {
                excludeKeys: ['password', 'token']
            });
            expect(result).toEqual({
                id: 1,
                name: 'John',
                email: 'john@example.com',
                age: 30
            });
        });

        it('清洗日志数据（限制长度）', () => {
            const logData = {
                message: 'Error: ' + 'A'.repeat(10000),
                stack: 'B'.repeat(10000),
                timestamp: Date.now()
            };
            const result = cleanData(logData, { maxLen: 500 });
            expect(result.message.length).toBe(500);
            expect(result.stack.length).toBe(500);
            expect(result.timestamp).toBeDefined();
        });

        it('清洗 API 响应（移除空值）', () => {
            const apiResponse = {
                data: { id: 1, name: 'Test' },
                error: null,
                warning: undefined,
                meta: { total: 10 }
            };
            const result = cleanData(apiResponse, {
                removeValues: [null, undefined]
            });
            expect(result).toEqual({
                data: { id: 1, name: 'Test' },
                meta: { total: 10 }
            });
        });

        it('清洗表单数据（只保留指定字段）', () => {
            const formData = {
                username: 'john',
                password: '123456',
                email: 'john@example.com',
                remember: true,
                csrf_token: 'xxx'
            };
            const result = cleanData(formData, {
                includeKeys: ['username', 'password', 'email']
            });
            expect(result).toEqual({
                username: 'john',
                password: '123456',
                email: 'john@example.com'
            });
        });
    });
});
