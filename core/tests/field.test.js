import { describe, expect, test } from 'bun:test';
import { parseRule } from '../utils/index.js';

describe('parseRule 字段规则解析', () => {
    test('返回7段并进行必要的数值转换', () => {
        const rule = '用户名⚡string⚡2⚡50⚡匿名用户⚡1⚡^.+$';
        const parts = parseRule(rule);
        expect(parts.length).toBe(7);
        expect(parts[0]).toBe('用户名');
        expect(parts[1]).toBe('string');
        expect(parts[2]).toBe('2'); // 当前实现保留为字符串
        expect(parts[3]).toBe('50'); // 当前实现保留为字符串
        expect(parts[4]).toBe('匿名用户'); // string 默认值保持
        expect(parts[5]).toBe(1); // 是否索引为数字
        expect(parts[6]).toBe('^.+$');
    });

    test('空字符串段在数值位转为0；字面量 null/undefined 保持原样', () => {
        const rule = 'a⚡string⚡⚡⚡null⚡0⚡undefined';
        const parts = parseRule(rule);
        expect(parts.length).toBe(7);
        expect(parts[2]).toBe(''); // 当前实现保留空字符串
        expect(parts[3]).toBe(''); // 当前实现保留空字符串
        expect(parts[4]).toBe('null'); // 默认值字面量 null 保持
        expect(parts[6]).toBe('undefined'); // 正则字面量保持
    });

    test('number 类型默认值转为数字', () => {
        const rule = '年龄⚡number⚡0⚡150⚡18⚡0⚡null';
        const parts = parseRule(rule);
        expect(parts[4]).toBe(18);
    });

    test('额外分段当前被舍弃（仅返回前7段）', () => {
        const parts = parseRule('a⚡b⚡c⚡d⚡e⚡f⚡g⚡h');
        expect(parts.length).toBe(7);
        expect(parts[6]).toBe('g');
    });
});
