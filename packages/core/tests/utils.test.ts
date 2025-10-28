/**
 * 核心工具函数测试 - TypeScript 版本
 * 测试 utils/index.ts 中的工具函数
 */

import { describe, test, expect } from 'bun:test';
import { snakeCase } from 'es-toolkit/string';
import { Yes, No, pickFields, formatDate, parseRule } from '../util.js';

describe('响应函数', () => {
    test('Yes 应该返回成功响应', () => {
        const result = Yes('操作成功', { id: 1 });
        expect(result.code).toBe(0);
        expect(result.msg).toBe('操作成功');
        expect(result.data).toEqual({ id: 1 });
    });

    test('No 应该返回失败响应', () => {
        const result = No('操作失败', { error: 'test' });
        expect(result.code).toBe(1);
        expect(result.msg).toBe('操作失败');
        expect(result.data).toEqual({ error: 'test' });
    });
});

describe('对象操作', () => {
    test('pickFields 应该提取指定字段', () => {
        const obj = { a: 1, b: 2, c: 3 };
        const result = pickFields(obj, ['a', 'c']);
        expect(result).toEqual({ a: 1, c: 3 });
    });

    // omitFields 函数已移除，测试已注释
    // test('omitFields 应该排除指定字段', () => {
    //     const obj = { a: 1, b: 2, c: 3 };
    //     const result = omitFields(obj, ['b']);
    //     expect(result).toEqual({ a: 1, c: 3 });
    // });
});

describe('日期格式化', () => {
    test('formatDate 应该正确格式化日期', () => {
        const date = new Date('2025-01-01T12:00:00Z');
        const result = formatDate(date, 'YYYY-MM-DD');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('formatDate 应该支持完整格式', () => {
        const date = new Date('2025-01-01T12:00:00Z');
        const result = formatDate(date, 'YYYY-MM-DD HH:mm:ss');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
});

describe('表名转换', () => {
    test('snakeCase 应该转换为蛇形命名', () => {
        expect(snakeCase('userTable')).toBe('user_table');
        expect(snakeCase('testNewFormat')).toBe('test_new_format');
        expect(snakeCase('common')).toBe('common');
    });
});

describe('规则解析', () => {
    test('parseRule 应该正确解析字段规则', () => {
        const rule = '用户名|string|3|50|null|1|^[a-zA-Z0-9_]+$';
        const result = parseRule(rule);

        expect(result.name).toBe('用户名');
        expect(result.type).toBe('string');
        expect(result.min).toBe(3);
        expect(result.max).toBe(50);
        expect(result.default).toBe('null');
        expect(result.index).toBe(1);
        expect(result.regex).toBe('^[a-zA-Z0-9_]+$');
    });

    test('parseRule 应该处理数字类型', () => {
        const rule = '年龄|number|0|150|0|0|null';
        const result = parseRule(rule);

        expect(result.type).toBe('number');
        expect(result.default).toBe(0);
    });
});
