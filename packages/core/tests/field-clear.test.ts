import { describe, expect, test } from 'bun:test';

/**
 * 字段清理功能测试
 */
import { fieldClear } from '../utils/util.js';

describe('fieldClear - 字段清理功能', () => {
    // ========================================
    // 基础功能测试
    // ========================================

    test('基础：返回对象副本，不修改原对象', () => {
        const original = { a: 1, b: 2, c: 3 };
        const result = fieldClear(original, [null, undefined], {});

        expect(result).toEqual({ a: 1, b: 2, c: 3 });
        expect(result).not.toBe(original);
    });

    test('基础：空对象输入返回空对象', () => {
        const result = fieldClear({}, [null, undefined], {});
        expect(result).toEqual({});
    });

    test('基础：默认移除 null 和 undefined', () => {
        const data = { a: 1, b: null, c: undefined, d: 2 };
        const result = fieldClear(data, [null, undefined], {});

        expect(result).toEqual({ a: 1, d: 2 });
    });

    // ========================================
    // 非对象类型处理
    // ========================================

    test('非对象：数组输入返回空对象', () => {
        const result = fieldClear([1, 2, 3] as any, [null, undefined], {});
        expect(result).toEqual({});
    });

    test('非对象：null 输入返回空对象', () => {
        const result = fieldClear(null as any, [null, undefined], {});
        expect(result).toEqual({});
    });

    test('非对象：undefined 输入返回空对象', () => {
        const result = fieldClear(undefined as any, [null, undefined], {});
        expect(result).toEqual({});
    });

    test('非对象：字符串输入返回空对象', () => {
        const result = fieldClear('hello' as any, [null, undefined], {});
        expect(result).toEqual({});
    });

    test('非对象：数字输入返回空对象', () => {
        const result = fieldClear(123 as any, [null, undefined], {});
        expect(result).toEqual({});
    });

    // ========================================
    // excludeValues 参数测试
    // ========================================

    test('excludeValues：排除单个值', () => {
        const data = { a: 1, b: null, c: 3 };
        const result = fieldClear(data, [null], {});

        expect(result).toEqual({ a: 1, c: 3 });
    });

    test('excludeValues：排除多个值', () => {
        const data = { a: 1, b: null, c: 3, d: undefined, e: '' };
        const result = fieldClear(data, [null, undefined, ''], {});

        expect(result).toEqual({ a: 1, c: 3 });
    });

    test('excludeValues：排除数字 0', () => {
        const data = { a: 1, b: 0, c: 3 };
        const result = fieldClear(data, [0], {});

        expect(result).toEqual({ a: 1, c: 3 });
    });

    test('excludeValues：排除空字符串', () => {
        const data = { a: 'hello', b: '', c: 'world' };
        const result = fieldClear(data, [''], {});

        expect(result).toEqual({ a: 'hello', c: 'world' });
    });

    test('excludeValues：空数组不排除任何值', () => {
        const data = { a: 1, b: null, c: undefined };
        const result = fieldClear(data, [], {});

        expect(result).toEqual({ a: 1, b: null, c: undefined });
    });

    // ========================================
    // keepValues 参数测试
    // ========================================

    test('keepValues：保留空字符串值', () => {
        const data = { category: '', name: 'John', age: 30 };
        const result = fieldClear(data, [''], { category: '' });

        expect(result).toEqual({ category: '', name: 'John', age: 30 });
    });

    test('keepValues：保留数字 0 值', () => {
        const data = { recordId: 0, count: 5, total: 10 };
        const result = fieldClear(data, [0], { recordId: 0 });

        expect(result).toEqual({ recordId: 0, count: 5, total: 10 });
    });

    test('keepValues：保留多个特定值', () => {
        const data = { category: '', recordId: 0, name: 'John', age: 30 };
        const result = fieldClear(data, ['', 0], { category: '', recordId: 0 });

        expect(result).toEqual({ category: '', recordId: 0, name: 'John', age: 30 });
    });

    test('keepValues：保留 false 值', () => {
        const data = { enabled: false, visible: true, active: false };
        const result = fieldClear(data, [false], { enabled: false, active: false });

        expect(result).toEqual({ enabled: false, visible: true, active: false });
    });

    test('keepValues：保留 null 值（排除时明确保留）', () => {
        const data = { a: 1, b: null, c: 3 };
        const result = fieldClear(data, [null], { b: null });

        expect(result).toEqual({ a: 1, b: null, c: 3 });
    });

    test('keepValues：保留 undefined 值（排除时明确保留）', () => {
        const data = { a: 1, b: undefined, c: 3 };
        const result = fieldClear(data, [undefined], { b: undefined });

        expect(result).toEqual({ a: 1, b: undefined, c: 3 });
    });

    test('keepValues：值不匹配时应该被保留（因为不在 excludeValues 中）', () => {
        const data = { category: 'sports', recordId: 1 };
        const result = fieldClear(data, ['', 0], { category: '', recordId: 0 });

        // category 和 recordId 的值不匹配 keepValues，但也不在 excludeValues 中，应该保留
        expect(result).toEqual({ category: 'sports', recordId: 1 });
    });

    test('keepValues：空对象时按默认行为处理', () => {
        const data = { a: 1, b: null, c: undefined, d: 2 };
        const result = fieldClear(data, [null, undefined], {});

        expect(result).toEqual({ a: 1, d: 2 });
    });

    // ========================================
    // 特殊值测试（Object.is 严格比较）
    // ========================================

    test('特殊值：正确处理 NaN', () => {
        const data = { a: 1, b: NaN, c: 3 };
        const result = fieldClear(data, [NaN], { b: NaN });

        expect(result.a).toBe(1);
        expect(result.c).toBe(3);
        expect(Number.isNaN(result.b)).toBe(true);
    });

    test('特殊值：正确区分 +0 和 -0', () => {
        const data = { a: +0, b: -0, c: 1 };
        const result = fieldClear(data, [+0], { a: +0 });

        // a 匹配 keepValues 中的 +0，被保留
        // b 是 -0，在 excludeValues 中没有匹配（Object.is(+0, -0) = false），所以被保留
        expect(result).toEqual({ a: +0, b: -0, c: 1 });
        expect(Object.is(result.a, +0)).toBe(true);
        expect(Object.is(result.b, -0)).toBe(true);
    });

    // ========================================
    // 组合使用测试
    // ========================================

    test('组合：excludeValues + keepValues', () => {
        const data = { a: null, b: '', c: 0, d: 1, e: 2 };
        const result = fieldClear(data, [null, '', 0], { b: '', c: 0 });

        expect(result).toEqual({ b: '', c: 0, d: 1, e: 2 });
    });

    test('组合：keepValues 优先于 excludeValues', () => {
        const data = { a: '', b: 0, c: 1 };
        const result = fieldClear(data, ['', 0], { a: '' });

        // a 在 keepValues 中且值匹配，优先保留（即使在 excludeValues 中）
        expect(result).toEqual({ a: '', c: 1 });
    });

    test('组合：复杂数据结构', () => {
        const data = {
            id: 1,
            name: 'John',
            category: '',
            recordId: 0,
            description: null,
            tags: undefined,
            active: true,
            count: 5
        };
        const result = fieldClear(data, [null, undefined, '', 0], { category: '', recordId: 0 });

        expect(result).toEqual({
            id: 1,
            name: 'John',
            category: '',
            recordId: 0,
            active: true,
            count: 5
        });
    });

    // ========================================
    // 实际场景测试
    // ========================================

    test('场景1：清理 API 请求参数（保留空字符串和 0）', () => {
        const params = {
            keyword: '',
            page: 1,
            limit: 10,
            category: '',
            minPrice: 0,
            maxPrice: null,
            sortBy: undefined
        };
        const result = fieldClear(params, [null, undefined, '', 0], { keyword: '', category: '', minPrice: 0 });

        expect(result).toEqual({
            keyword: '',
            page: 1,
            limit: 10,
            category: '',
            minPrice: 0
        });
    });

    test('场景2：清理表单数据（排除 null 值）', () => {
        const formData = {
            username: 'john',
            email: 'john@example.com',
            password: '123456',
            confirmPassword: '123456',
            age: 30,
            bio: null
        };
        const result = fieldClear(formData, [null], {});

        expect(result).toEqual({
            username: 'john',
            email: 'john@example.com',
            password: '123456',
            confirmPassword: '123456',
            age: 30
        });
    });

    test('场景3：清理日志数据（排除空值但保留特定字段）', () => {
        const logData = {
            userId: 123,
            action: 'login',
            ip: '192.168.1.1',
            userAgent: '',
            token: 'abc123',
            error: null,
            timestamp: 1697452800000
        };
        const result = fieldClear(logData, ['', null], { userAgent: '', error: null });

        expect(result).toEqual({
            userId: 123,
            action: 'login',
            ip: '192.168.1.1',
            userAgent: '',
            error: null,
            token: 'abc123',
            timestamp: 1697452800000
        });
    });

    test('场景4：清理数据库查询结果（排除 null 和保留 0）', () => {
        const dbRecord = {
            id: 1,
            name: 'Product',
            price: 0,
            stock: 100,
            created_at: 1697452800000,
            updated_at: 1697452800000,
            deleted_at: null
        };
        const result = fieldClear(dbRecord, [null], { price: 0 });

        expect(result).toEqual({
            id: 1,
            name: 'Product',
            price: 0,
            stock: 100,
            created_at: 1697452800000,
            updated_at: 1697452800000
        });
    });
});
