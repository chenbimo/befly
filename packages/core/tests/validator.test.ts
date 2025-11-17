import { describe, test, expect } from 'bun:test';
import { Validator } from '../lib/validator';

const validator = new Validator();

describe('Validator - 基本验证', () => {
    test('验证通过', () => {
        const data = { username: 'john' };
        const rules = { username: { name: '用户名', type: 'string', min: 2, max: 20 } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(0);
        expect(Object.keys(result.fields).length).toBe(0);
    });

    test('验证失败 - 必填字段缺失', () => {
        const data = {};
        const rules = { username: { name: '用户名', type: 'string', min: 2, max: 20 } };
        const required = ['username'];
        const result = validator.validate(data, rules, required);
        expect(result.code).toBe(1);
        expect(result.fields.username).toContain('必填项');
    });

    test('验证失败 - 字段值为空', () => {
        const data = { username: '' };
        const rules = { username: { name: '用户名', type: 'string', min: 2, max: 20 } };
        const required = ['username'];
        const result = validator.validate(data, rules, required);
        expect(result.code).toBe(1);
        expect(result.fields.username).toBeDefined();
    });
});

describe('Validator - 类型验证', () => {
    test('string 类型', () => {
        const data = { name: 'test' };
        const rules = { name: { name: '名称', type: 'string', min: 2, max: 10 } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(0);
    });

    test('number 类型', () => {
        const data = { age: 25 };
        const rules = { age: { name: '年龄', type: 'number', min: 0, max: 150 } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(0);
    });

    test('email 验证', () => {
        const data = { email: 'test@example.com' };
        const rules = { email: { name: '邮箱', type: 'string', regexp: '@email' } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(0);
    });

    test('phone 验证', () => {
        const data = { phone: '13800138000' };
        const rules = { phone: { name: '手机号', type: 'string', regexp: '@phone' } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(0);
    });
});

describe('Validator - 长度验证', () => {
    test('string 最小长度', () => {
        const data = { name: 'a' };
        const rules = { name: { name: '名称', type: 'string', min: 2, max: 10 } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(1);
        expect(result.fields.name).toBeDefined();
    });

    test('string 最大长度', () => {
        const data = { name: 'a'.repeat(20) };
        const rules = { name: { name: '名称', type: 'string', min: 2, max: 10 } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(1);
        expect(result.fields.name).toBeDefined();
    });

    test('number 范围验证', () => {
        const data = { age: 200 };
        const rules = { age: { name: '年龄', type: 'number', min: 0, max: 150 } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(1);
        expect(result.fields.age).toBeDefined();
    });
});

describe('Validator - 正则验证', () => {
    test('正则别名 @email - 有效邮箱', () => {
        const data = { email: 'test@example.com' };
        const rules = { email: { name: '邮箱', type: 'string', regexp: '@email' } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(0);
    });

    test('正则别名 @email - 无效邮箱', () => {
        const data = { email: 'invalid-email' };
        const rules = { email: { name: '邮箱', type: 'string', regexp: '@email' } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(1);
        expect(result.fields.email).toBeDefined();
    });

    test('正则别名 @phone - 有效手机号', () => {
        const data = { phone: '13800138000' };
        const rules = { phone: { name: '手机号', type: 'string', regexp: '@phone' } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(0);
    });

    test('正则别名 @phone - 无效手机号', () => {
        const data = { phone: '12345' };
        const rules = { phone: { name: '手机号', type: 'string', regexp: '@phone' } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(1);
        expect(result.fields.phone).toBeDefined();
    });

    test('自定义正则 - 纯数字', () => {
        const data = { code: '12a' };
        const rules = { code: { name: '验证码', type: 'string', regexp: '^\\d+$' } };
        const result = validator.validate(data, rules);
        expect(result.code).toBe(1);
        expect(result.fields.code).toBeDefined();
    });
});

describe('Validator - 参数检查', () => {
    test('data 不是对象', () => {
        const result = validator.validate(null as any, {});
        expect(result.code).toBe(1);
        expect(result.fields.error).toContain('对象格式');
    });

    test('rules 不是对象', () => {
        const result = validator.validate({}, null as any);
        expect(result.code).toBe(1);
        expect(result.fields.error).toContain('对象格式');
    });

    test('required 不是数组', () => {
        const result = validator.validate({}, {}, 'invalid' as any);
        expect(result.code).toBe(1);
        expect(result.fields.error).toContain('数组格式');
    });
});
