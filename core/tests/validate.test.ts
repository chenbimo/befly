/**
 * 数据验证器测试 - TypeScript 版本
 * 测试 utils/validate.ts 中的验证功能
 */

import { describe, test, expect } from 'bun:test';
import { Validator } from '../utils/validate.js';

describe('字符串验证', () => {
    test('应该验证有效的字符串', () => {
        const rule = '用户名⚡string⚡3⚡20⚡null⚡0⚡null';
        const result = Validator.validate('testuser', rule);

        expect(Validator.isPassed(result)).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('应该拒绝过短的字符串', () => {
        const rule = '用户名⚡string⚡5⚡20⚡null⚡0⚡null';
        const result = Validator.validate('abc', rule);

        expect(Validator.isPassed(result)).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    test('应该拒绝过长的字符串', () => {
        const rule = '用户名⚡string⚡3⚡10⚡null⚡0⚡null';
        const result = Validator.validate('verylongusername', rule);

        expect(Validator.isPassed(result)).toBe(false);
    });

    test('应该验证正则表达式', () => {
        const rule = '邮箱⚡string⚡5⚡100⚡null⚡0⚡^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
        const validEmail = Validator.validate('test@example.com', rule);
        const invalidEmail = Validator.validate('invalid-email', rule);

        expect(Validator.isPassed(validEmail)).toBe(true);
        expect(Validator.isPassed(invalidEmail)).toBe(false);
    });
});

describe('数字验证', () => {
    test('应该验证有效的数字', () => {
        const rule = '年龄⚡number⚡0⚡150⚡0⚡0⚡null';
        const result = Validator.validate(25, rule);

        expect(Validator.isPassed(result)).toBe(true);
    });

    test('应该拒绝超出范围的数字', () => {
        const rule = '年龄⚡number⚡0⚡150⚡0⚡0⚡null';
        const tooSmall = Validator.validate(-1, rule);
        const tooBig = Validator.validate(200, rule);

        expect(Validator.isPassed(tooSmall)).toBe(false);
        expect(Validator.isPassed(tooBig)).toBe(false);
    });

    test('应该验证数字的正则表达式', () => {
        const rule = '状态⚡number⚡0⚡1⚡0⚡0⚡^(0|1)$';
        const valid = Validator.validate(1, rule);
        const invalid = Validator.validate(2, rule);

        expect(Validator.isPassed(valid)).toBe(true);
        expect(Validator.isPassed(invalid)).toBe(false);
    });
});

describe('数组验证', () => {
    test('应该验证有效的数组', () => {
        const rule = '标签⚡array⚡0⚡10⚡[]⚡0⚡null';
        const result = Validator.validate(['tag1', 'tag2'], rule);

        expect(Validator.isPassed(result)).toBe(true);
    });

    test('应该拒绝元素过多的数组', () => {
        const rule = '标签⚡array⚡0⚡3⚡[]⚡0⚡null';
        const result = Validator.validate(['a', 'b', 'c', 'd'], rule);

        expect(Validator.isPassed(result)).toBe(false);
    });

    test('应该验证数组元素的正则表达式', () => {
        const rule = '手机号列表⚡array⚡0⚡5⚡[]⚡0⚡^1[3-9]\\d{9}$';
        const valid = Validator.validate(['13812345678', '13998765432'], rule);
        const invalid = Validator.validate(['13812345678', '12345'], rule);

        expect(Validator.isPassed(valid)).toBe(true);
        expect(Validator.isPassed(invalid)).toBe(false);
    });

    test('应该接受空数组（当最小值为0）', () => {
        const rule = '标签⚡array⚡0⚡10⚡[]⚡0⚡null';
        const result = Validator.validate([], rule);

        expect(Validator.isPassed(result)).toBe(true);
    });
});

describe('文本验证', () => {
    test('应该验证文本类型', () => {
        const rule = '内容⚡text⚡null⚡null⚡null⚡0⚡null';
        const result = Validator.validate('这是一段很长的文本内容...', rule);

        expect(Validator.isPassed(result)).toBe(true);
    });

    test('应该接受超长文本', () => {
        const rule = '内容⚡text⚡null⚡null⚡null⚡0⚡null';
        const longText = 'a'.repeat(100000);
        const result = Validator.validate(longText, rule);

        expect(Validator.isPassed(result)).toBe(true);
    });
});

describe('默认值处理', () => {
    test('应该使用字符串默认值', () => {
        const rule = '状态⚡string⚡1⚡20⚡active⚡0⚡null';
        const result = Validator.validate(undefined, rule);

        expect(result.value).toBe('active');
        expect(Validator.isPassed(result)).toBe(true);
    });

    test('应该使用数字默认值', () => {
        const rule = '计数⚡number⚡0⚡100⚡0⚡0⚡null';
        const result = Validator.validate(undefined, rule);

        expect(result.value).toBe(0);
        expect(Validator.isPassed(result)).toBe(true);
    });

    test('应该使用数组默认值', () => {
        const rule = '标签⚡array⚡0⚡10⚡[]⚡0⚡null';
        const result = Validator.validate(undefined, rule);

        expect(result.value).toEqual([]);
        expect(Validator.isPassed(result)).toBe(true);
    });
});

describe('静态辅助方法', () => {
    test('isPassed 应该正确判断验证结果', () => {
        const passed = { valid: true, value: 'test', errors: [] };
        const failed = { valid: false, value: null, errors: ['error'] };

        expect(Validator.isPassed(passed)).toBe(true);
        expect(Validator.isPassed(failed)).toBe(false);
    });

    test('getFirstError 应该返回第一个错误', () => {
        const result = {
            valid: false,
            value: null,
            errors: ['错误1', '错误2', '错误3']
        };

        expect(Validator.getFirstError(result)).toBe('错误1');
    });

    test('getFirstError 应该在没有错误时返回 null', () => {
        const result = { valid: true, value: 'test', errors: [] };

        expect(Validator.getFirstError(result)).toBe(null);
    });

    test('getAllErrors 应该返回所有错误', () => {
        const result = {
            valid: false,
            value: null,
            errors: ['错误1', '错误2']
        };

        const errors = Validator.getAllErrors(result);
        expect(errors).toHaveLength(2);
        expect(errors).toContain('错误1');
        expect(errors).toContain('错误2');
    });
});

describe('类型转换', () => {
    test('应该将字符串数字转换为数字', () => {
        const rule = '年龄⚡number⚡0⚡150⚡0⚡0⚡null';
        const result = Validator.validate('25', rule);

        expect(Validator.isPassed(result)).toBe(true);
        expect(typeof result.value).toBe('number');
        expect(result.value).toBe(25);
    });

    test('应该拒绝无效的数字字符串', () => {
        const rule = '年龄⚡number⚡0⚡150⚡0⚡0⚡null';
        const result = Validator.validate('abc', rule);

        expect(Validator.isPassed(result)).toBe(false);
    });
});
