/**
 * 测试 keepValues 优先级逻辑
 */

import { describe, test, expect } from 'bun:test';
import { fieldClear } from '../utils/util.js';

describe('keepValues 优先级测试', () => {
    test('场景1：字段在 keepValues 中且值匹配 - 应该保留', () => {
        const data = { category: '', name: 'John' };
        const result = fieldClear(data, [''], { category: '' });

        // category 在 keepValues 中且值匹配 ''，应该保留
        expect(result).toEqual({ category: '', name: 'John' });
    });

    test('场景2：字段在 keepValues 中但值不匹配 - 应该继续执行 excludeValues 检查', () => {
        const data = { category: 'sports', name: 'John' };
        const result = fieldClear(data, [''], { category: '' });

        // category 在 keepValues 中但值是 'sports' 不匹配 ''
        // 继续检查 excludeValues，'sports' 不在 [''] 中，所以保留
        expect(result).toEqual({ category: 'sports', name: 'John' });
    });

    test('场景3：字段在 keepValues 中但值不匹配，且值在 excludeValues 中 - 应该被排除', () => {
        const data = { category: null, name: 'John' };
        const result = fieldClear(data, [null], { category: '' });

        // category 在 keepValues 中但值是 null 不匹配 ''
        // 继续检查 excludeValues，null 在 [null] 中，所以被排除
        expect(result).toEqual({ name: 'John' });
    });

    test('场景4：复杂场景 - 多个字段，部分匹配，部分不匹配', () => {
        const data = {
            category: '', // 在 keepValues 中且匹配，保留
            recordId: 0, // 在 keepValues 中且匹配，保留
            name: 'John', // 不在 keepValues 中，不在 excludeValues 中，保留
            description: '', // 不在 keepValues 中，在 excludeValues 中，排除
            count: null, // 不在 keepValues 中，在 excludeValues 中，排除
            price: 0 // 在 keepValues 中但值不匹配（期望 10），在 excludeValues 中，排除
        };
        const result = fieldClear(data, [null, '', 0], { category: '', recordId: 0, price: 10 });

        expect(result).toEqual({
            category: '',
            recordId: 0,
            name: 'John'
        });
    });

    test('场景5：keepValues 优先级高于 excludeValues', () => {
        const data = { a: '', b: '', c: 'text' };
        const result = fieldClear(data, [''], { a: '' });

        // a 在 keepValues 中且匹配，保留（即使在 excludeValues 中）
        // b 不在 keepValues 中，在 excludeValues 中，排除
        // c 不在 keepValues 中，不在 excludeValues 中，保留
        expect(result).toEqual({ a: '', c: 'text' });
    });

    test('场景6：keepValues 中的字段，值不匹配，继续检查 excludeValues', () => {
        const data = {
            status: 0, // 在 keepValues 中期望 1，但实际是 0，在 excludeValues 中，排除
            enabled: 1 // 不在 keepValues 中，不在 excludeValues 中，保留
        };
        const result = fieldClear(data, [0], { status: 1 });

        expect(result).toEqual({ enabled: 1 });
    });

    test('场景7：空 keepValues，正常排除', () => {
        const data = { a: 1, b: null, c: '', d: 2 };
        const result = fieldClear(data, [null, ''], {});

        expect(result).toEqual({ a: 1, d: 2 });
    });

    test('场景8：空 excludeValues，只看 keepValues', () => {
        const data = { a: '', b: 'text', c: null };
        const result = fieldClear(data, [], { a: '' });

        // 空 excludeValues 意味着不排除任何值
        expect(result).toEqual({ a: '', b: 'text', c: null });
    });

    test('场景9：keepValues 和 excludeValues 都为空，保留所有字段', () => {
        const data = { a: 1, b: null, c: '', d: 0 };
        const result = fieldClear(data, [], {});

        expect(result).toEqual({ a: 1, b: null, c: '', d: 0 });
    });

    test('场景10：同一个值，不同字段，不同处理', () => {
        const data = {
            category: '', // 在 keepValues 中且匹配，保留
            description: '', // 不在 keepValues 中，在 excludeValues 中，排除
            title: '' // 不在 keepValues 中，在 excludeValues 中，排除
        };
        const result = fieldClear(data, [''], { category: '' });

        expect(result).toEqual({ category: '' });
    });
});
