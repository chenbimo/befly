/**
 * 测试验证字段第7个属性必须为null或正则表达式
 */

import { test, expect, describe } from 'bun:test';
import { validator } from '../utils/validate.js';

describe('字段第7个属性正则约束测试', () => {
    test('null值应该通过验证', () => {
        const data = { name: 'test' };
        const rules = { name: '姓名⚡string⚡1⚡50⚡null⚡0⚡null' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('有效正则表达式应该通过验证', () => {
        const data = { email: 'test@example.com' };
        const rules = { email: '邮箱⚡string⚡5⚡100⚡null⚡1⚡^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('正则表达式验证失败应该返回错误', () => {
        const data = { email: 'invalid-email' };
        const rules = { email: '邮箱⚡string⚡5⚡100⚡null⚡1⚡^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(1);
        expect(result.fields.email).toContain('格式不正确');
    });

    test('数字类型正则验证', () => {
        const data = { age: 25 };
        const rules = { age: '年龄⚡number⚡1⚡120⚡null⚡0⚡^\\d{1,3}$' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('数组类型正则验证', () => {
        const data = { tags: ['tag1', 'tag2'] };
        const rules = { tags: '标签⚡array⚡0⚡10⚡[]⚡0⚡^[a-zA-Z0-9]+$' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('数组元素不匹配正则表达式', () => {
        const data = { tags: ['tag1', 'tag-2'] }; // tag-2 包含连字符，不匹配正则
        const rules = { tags: '标签⚡array⚡0⚡10⚡[]⚡0⚡^[a-zA-Z0-9]+$' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(1);
        expect(result.fields.tags).toContain('tag-2');
        expect(result.fields.tags).toContain('格式不正确');
    });

    // 正则表达式枚举测试
    test('正则表达式实现字符串枚举 - 有效值', () => {
        const data = { status: 'active' };
        const rules = { status: '状态⚡string⚡1⚡20⚡null⚡0⚡^(active|inactive|pending)$' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('正则表达式实现字符串枚举 - 无效值', () => {
        const data = { status: 'unknown' };
        const rules = { status: '状态⚡string⚡1⚡20⚡null⚡0⚡^(active|inactive|pending)$' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(1);
        expect(result.fields.status).toContain('格式不正确');
    });

    test('正则表达式实现数字枚举 - 有效值', () => {
        const data = { priority: 3 };
        const rules = { priority: '优先级⚡number⚡1⚡10⚡null⚡0⚡^(1|2|3|4|5)$' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('正则表达式实现数字枚举 - 无效值', () => {
        const data = { priority: 7 }; // 7 不在枚举 1,2,3,4,5 中，但在范围 1-10 内
        const rules = { priority: '优先级⚡number⚡1⚡10⚡null⚡0⚡^(1|2|3|4|5)$' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(1);
        expect(result.fields.priority).toContain('格式不正确');
    });

    test('正则表达式实现复杂枚举 - 用户角色', () => {
        const data = { role: 'admin' };
        const rules = { role: '角色⚡string⚡1⚡20⚡null⚡0⚡^(admin|user|guest|moderator)$' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('正则表达式实现数组枚举 - 所有元素有效', () => {
        const data = { colors: ['red', 'green', 'blue'] };
        const rules = { colors: '颜色⚡array⚡1⚡5⚡[]⚡0⚡^(red|green|blue|yellow|purple)$' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('正则表达式实现数组枚举 - 包含无效元素', () => {
        const data = { colors: ['red', 'orange', 'blue'] }; // orange 不在枚举中
        const rules = { colors: '颜色⚡array⚡1⚡5⚡[]⚡0⚡^(red|green|blue|yellow|purple)$' };
        const result = validator.validate(data, rules);

        expect(result.code).toBe(1);
        expect(result.fields.colors).toContain('orange');
        expect(result.fields.colors).toContain('格式不正确');
    });
});
