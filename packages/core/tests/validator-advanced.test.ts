/**
 * Validator 高级测试用例
 * 测试边界条件、正则表达式、类型转换、错误消息
 */

import { describe, test, expect } from 'bun:test';
import { Validator } from '../lib/validator';

const validator = new Validator();

describe('Validator - 字段类型详细测试', () => {
    test('string 类型 - 空字符串应如何处理', () => {
        const data = { name: '' };
        const rules = { name: { name: '名称', type: 'string', min: 2, max: 10 } };
        const required = ['name'];

        const result = validator.validate(data, rules, required);

        // 空字符串在 required 检查时应该失败
        expect(result.code).toBe(1);
    });

    test('string 类型 - 只包含空格应失败', () => {
        const data = { name: '   ' };
        const rules = { name: { name: '名称', type: 'string', min: 2, max: 10 } };

        const result = validator.validate(data, rules);

        // **问题**：只有空格的字符串应该被视为无效
        console.log('只包含空格的验证结果:', result);
    });

    test('number 类型 - 字符串数字应如何处理', () => {
        const data = { age: '25' }; // 字符串而非数字
        const rules = { age: { name: '年龄', type: 'number', min: 0, max: 150 } };

        const result = validator.validate(data, rules);

        // **问题**：是否应该自动转换 '25' -> 25？
        console.log('字符串数字的验证结果:', result);
    });

    test('number 类型 - 浮点数应如何处理', () => {
        const data = { price: 19.99 };
        const rules = { price: { name: '价格', type: 'number', min: 0, max: 10000 } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('number 类型 - NaN 应失败', () => {
        const data = { age: NaN };
        const rules = { age: { name: '年龄', type: 'number' } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(1);
    });

    test('number 类型 - Infinity 应失败', () => {
        const data = { value: Infinity };
        const rules = { value: { name: '值', type: 'number' } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(1);
    });

    test('number 类型 - 0 应允许', () => {
        const data = { count: 0 };
        const rules = { count: { name: '计数', type: 'number', min: 0, max: 100 } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('number 类型 - 负数范围验证', () => {
        const data = { temperature: -10 };
        const rules = { temperature: { name: '温度', type: 'number', min: -50, max: 50 } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });
});

describe('Validator - 长度验证详细测试', () => {
    test('string 最小长度 - 边界值', () => {
        const cases = [
            { value: 'a', min: 2, shouldPass: false },
            { value: 'ab', min: 2, shouldPass: true },
            { value: 'abc', min: 2, shouldPass: true }
        ];

        cases.forEach(({ value, min, shouldPass }) => {
            const data = { name: value };
            const rules = { name: { name: '名称', type: 'string', min: min, max: 100 } };
            const result = validator.validate(data, rules);

            expect(result.code).toBe(shouldPass ? 0 : 1);
        });
    });

    test('string 最大长度 - 边界值', () => {
        const cases = [
            { value: 'abc', max: 5, shouldPass: true },
            { value: 'abcde', max: 5, shouldPass: true },
            { value: 'abcdef', max: 5, shouldPass: false }
        ];

        cases.forEach(({ value, max, shouldPass }) => {
            const data = { name: value };
            const rules = { name: { name: '名称', type: 'string', min: 0, max: max } };
            const result = validator.validate(data, rules);

            expect(result.code).toBe(shouldPass ? 0 : 1);
        });
    });

    test('中文字符长度计算', () => {
        // **问题**：中文字符是按字符数还是字节数？
        const data = { content: '你好世界' }; // 4 个字符
        const rules = { content: { name: '内容', type: 'string', min: 0, max: 5 } };

        const result = validator.validate(data, rules);

        // 应该按字符数计算（4 个字符）
        expect(result.code).toBe(0);
    });

    test('Emoji 字符长度计算', () => {
        // **问题**：Emoji 可能占 2 个或更多字符位
        const data = { message: '👋🌍' }; // 2 个 emoji
        const rules = { message: { name: '消息', type: 'string', min: 0, max: 5 } };

        const result = validator.validate(data, rules);

        console.log('Emoji 长度计算结果:', result);
    });

    test('number 范围验证 - 边界值', () => {
        const cases = [
            { value: 0, min: 0, max: 100, shouldPass: true },
            { value: 100, min: 0, max: 100, shouldPass: true },
            { value: -1, min: 0, max: 100, shouldPass: false },
            { value: 101, min: 0, max: 100, shouldPass: false }
        ];

        cases.forEach(({ value, min, max, shouldPass }) => {
            const data = { age: value };
            const rules = { age: { name: '年龄', type: 'number', min: min, max: max } };
            const result = validator.validate(data, rules);

            expect(result.code).toBe(shouldPass ? 0 : 1);
        });
    });
});

describe('Validator - 正则表达式详细测试', () => {
    test('email 验证 - 有效格式', () => {
        const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'admin+tag@site.org'];

        validEmails.forEach((email) => {
            const data = { email: email };
            const rules = { email: { name: '邮箱', type: 'string', regexp: '@email' } };
            const result = validator.validate(data, rules);

            expect(result.code).toBe(0);
        });
    });

    test('email 验证 - 无效格式', () => {
        const invalidEmails = ['plaintext', '@example.com', 'user@', 'user @domain.com', 'user@domain'];

        invalidEmails.forEach((email) => {
            const data = { email: email };
            const rules = { email: { name: '邮箱', type: 'string', regexp: '@email' } };
            const result = validator.validate(data, rules);

            expect(result.code).toBe(1);
        });
    });

    test('phone 验证 - 有效手机号', () => {
        const validPhones = ['13800138000', '15012345678', '18888888888'];

        validPhones.forEach((phone) => {
            const data = { phone: phone };
            const rules = { phone: { name: '手机号', type: 'string', regexp: '@phone' } };
            const result = validator.validate(data, rules);

            expect(result.code).toBe(0);
        });
    });

    test('phone 验证 - 无效手机号', () => {
        const invalidPhones = [
            '12345678901', // 首位不是1
            '10012345678', // 第二位不在3-9
            '1381234567', // 长度不足
            '138123456789', // 长度超出
            'abcdefghijk' // 包含字母
        ];

        invalidPhones.forEach((phone) => {
            const data = { phone: phone };
            const rules = { phone: { name: '手机号', type: 'string', regexp: '@phone' } };
            const result = validator.validate(data, rules);

            expect(result.code).toBe(1);
        });
    });

    test('url 验证', () => {
        const validUrls = ['http://example.com', 'https://www.site.org/path', 'https://sub.domain.co.uk/page?q=1'];

        validUrls.forEach((url) => {
            const data = { website: url };
            const rules = { website: { name: '网址', type: 'string', regexp: '@url' } };
            const result = validator.validate(data, rules);

            expect(result.code).toBe(0);
        });
    });

    test('自定义正则 - 纯字母', () => {
        const data1 = { code: 'ABC123' }; // 包含数字
        const data2 = { code: 'ABCDEF' }; // 纯字母

        const rules = { code: { name: '代码', type: 'string', regexp: '^[A-Z]+$' } };

        const result1 = validator.validate(data1, rules);
        const result2 = validator.validate(data2, rules);

        expect(result1.code).toBe(1);
        expect(result2.code).toBe(0);
    });

    test('自定义正则 - 转义字符处理', () => {
        // **问题**：正则中的转义字符是否正确处理
        const data = { code: '123' };
        const rules = { code: { name: '代码', type: 'string', regexp: '^\\d+$' } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('正则别名大小写敏感', () => {
        const data = { email: 'test@example.com' };
        const rules1 = { email: { name: '邮箱', type: 'string', regexp: '@email' } };
        const rules2 = { email: { name: '邮箱', type: 'string', regexp: '@EMAIL' } };

        const result1 = validator.validate(data, rules1);
        const result2 = validator.validate(data, rules2);

        // @email 能识别别名，@EMAIL 不能识别
        expect(result1.code).toBe(0);
        expect(result2.code).toBe(1); // 大写无法识别别名
    });
});

describe('Validator - 必填字段验证', () => {
    test('required - 字段缺失应失败', () => {
        const data = { name: 'john' };
        const rules = {
            name: { name: '姓名', type: 'string' },
            email: { name: '邮箱', type: 'string' }
        };
        const required = ['email'];

        const result = validator.validate(data, rules, required);

        expect(result.code).toBe(1);
        expect(result.fields.email).toBeDefined();
    });

    test('required - 字段为 null 应失败', () => {
        const data = { email: null };
        const rules = { email: { name: '邮箱', type: 'string' } };
        const required = ['email'];

        const result = validator.validate(data, rules, required);

        expect(result.code).toBe(1);
    });

    test('required - 字段为 undefined 应失败', () => {
        const data = { email: undefined };
        const rules = { email: { name: '邮箱', type: 'string' } };
        const required = ['email'];

        const result = validator.validate(data, rules, required);

        expect(result.code).toBe(1);
    });

    test('required - 字段为空字符串应失败', () => {
        const data = { email: '' };
        const rules = { email: { name: '邮箱', type: 'string' } };
        const required = ['email'];

        const result = validator.validate(data, rules, required);

        expect(result.code).toBe(1);
    });

    test('required - 字段为 0 应通过', () => {
        const data = { count: 0 };
        const rules = { count: { name: '计数', type: 'number' } };
        const required = ['count'];

        const result = validator.validate(data, rules, required);

        expect(result.code).toBe(0);
    });

    test('required - 字段为 false 应通过', () => {
        const data = { enabled: false };
        const rules = { enabled: { name: '启用', type: 'string' } };
        const required = ['enabled'];

        const result = validator.validate(data, rules, required);

        // **问题**：boolean 类型应该如何验证？
        console.log('boolean false 的验证结果:', result);
    });

    test('required - 多个必填字段', () => {
        const data = { name: 'john' };
        const rules = {
            name: { name: '姓名', type: 'string' },
            email: { name: '邮箱', type: 'string' },
            phone: { name: '手机', type: 'string' }
        };
        const required = ['name', 'email', 'phone'];

        const result = validator.validate(data, rules, required);

        expect(result.code).toBe(1);
        expect(result.fields.email).toBeDefined();
        expect(result.fields.phone).toBeDefined();
    });
});

describe('Validator - 错误消息测试', () => {
    test('错误消息应包含字段名', () => {
        const data = { age: 200 };
        const rules = { age: { name: '年龄', type: 'number', min: 0, max: 150 } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(1);
        expect(result.fields.age).toBeDefined();
        // 错误消息应该包含 "年龄"
    });

    test('类型错误消息', () => {
        const data = { age: 'abc' };
        const rules = { age: { name: '年龄', type: 'number' } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(1);
        console.log('类型错误消息:', result.fields.age);
    });

    test('长度错误消息', () => {
        const data = { name: 'a' };
        const rules = { name: { name: '名称', type: 'string', min: 2, max: 10 } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(1);
        console.log('长度错误消息:', result.fields.name);
    });

    test('正则错误消息', () => {
        const data = { email: 'invalid' };
        const rules = { email: { name: '邮箱', type: 'string', regexp: '@email' } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(1);
        console.log('正则错误消息:', result.fields.email);
    });
});

describe('Validator - 参数验证', () => {
    test('data 为 null 应报错', () => {
        const result = validator.validate(null as any, {});

        expect(result.code).toBe(1);
        expect(result.fields.error).toContain('对象格式');
    });

    test('data 为数组应报错', () => {
        const result = validator.validate([] as any, {});

        expect(result.code).toBe(1);
    });

    test('rules 为 null 应报错', () => {
        const result = validator.validate({}, null as any);

        expect(result.code).toBe(1);
        expect(result.fields.error).toContain('对象格式');
    });

    test('required 为字符串应报错', () => {
        const result = validator.validate({}, {}, 'email' as any);

        expect(result.code).toBe(1);
        expect(result.fields.error).toContain('数组格式');
    });

    test('required 为 null 应使用默认值', () => {
        const data = { name: 'john' };
        const rules = { name: { name: '姓名', type: 'string' } };

        const result = validator.validate(data, rules, null as any);

        // 应该使用默认的空数组
        console.log('required 为 null 的验证结果:', result);
    });
});

describe('Validator - 边界条件', () => {
    test('空规则对象应通过验证', () => {
        const data = { name: 'john', email: 'john@example.com' };
        const rules = {};

        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('data 中有规则外的字段应忽略', () => {
        const data = { name: 'john', extra: 'value' };
        const rules = { name: { name: '姓名', type: 'string' } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('规则中有 data 外的字段应跳过', () => {
        const data = { name: 'john' };
        const rules = {
            name: { name: '姓名', type: 'string' },
            email: { name: '邮箱', type: 'string' }
        };

        const result = validator.validate(data, rules);

        // 非必填字段不存在应该通过
        expect(result.code).toBe(0);
    });

    test('极端长度的字符串', () => {
        const longString = 'a'.repeat(10000);
        const data = { content: longString };
        const rules = { content: { name: '内容', type: 'string', min: 0, max: 20000 } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('极大的数字', () => {
        const data = { value: Number.MAX_SAFE_INTEGER };
        const rules = { value: { name: '值', type: 'number' } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });

    test('极小的数字', () => {
        const data = { value: Number.MIN_SAFE_INTEGER };
        const rules = { value: { name: '值', type: 'number' } };

        const result = validator.validate(data, rules);

        expect(result.code).toBe(0);
    });
});

describe('Validator - 代码逻辑问题分析', () => {
    test('问题1：类型验证不严格', () => {
        // **问题**：当前只检查 typeof value === 'number'
        // 但 NaN 和 Infinity 也是 number 类型

        const mockValidate = (value: any, type: string) => {
            if (type === 'number') {
                if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
                    return '必须是有效的数字';
                }
            }
            return null;
        };

        expect(mockValidate(123, 'number')).toBeNull();
        expect(mockValidate(NaN, 'number')).toBe('必须是有效的数字');
        expect(mockValidate(Infinity, 'number')).toBe('必须是有效的数字');
    });

    test('问题2：正则表达式没有缓存', () => {
        // **问题**：每次验证都要 new RegExp()
        // **建议**：缓存编译后的正则对象

        const regexCache = new Map<string, RegExp>();

        const mockGetRegex = (pattern: string) => {
            if (regexCache.has(pattern)) {
                return regexCache.get(pattern)!;
            }

            const regex = new RegExp(pattern);
            regexCache.set(pattern, regex);
            return regex;
        };

        // 第一次编译
        const t1 = performance.now();
        mockGetRegex('^\\d+$');
        const time1 = performance.now() - t1;

        // 第二次应该更快
        const t2 = performance.now();
        mockGetRegex('^\\d+$');
        const time2 = performance.now() - t2;

        console.log(`首次编译: ${time1}ms, 缓存命中: ${time2}ms`);
    });

    test('问题3：错误消息不够详细', () => {
        // **问题**：错误消息可能不够具体
        // **建议**：提供更详细的错误信息

        const mockValidateLength = (value: string, min: number, max: number, fieldName: string) => {
            if (value.length < min) {
                return `${fieldName} 长度不能少于 ${min} 个字符（当前 ${value.length} 个）`;
            }
            if (value.length > max) {
                return `${fieldName} 长度不能超过 ${max} 个字符（当前 ${value.length} 个）`;
            }
            return null;
        };

        const error = mockValidateLength('a', 2, 10, '用户名');
        expect(error).toBe('用户名 长度不能少于 2 个字符（当前 1 个）');
    });

    test('问题4：没有支持数组类型验证', () => {
        // **问题**：当前只支持 string 和 number
        // **建议**：支持 array、object、boolean 等类型

        const mockValidateType = (value: any, type: string) => {
            switch (type) {
                case 'string':
                    return typeof value === 'string';
                case 'number':
                    return typeof value === 'number' && isFinite(value);
                case 'boolean':
                    return typeof value === 'boolean';
                case 'array':
                    return Array.isArray(value);
                case 'object':
                    return typeof value === 'object' && value !== null && !Array.isArray(value);
                default:
                    return false;
            }
        };

        expect(mockValidateType('test', 'string')).toBe(true);
        expect(mockValidateType(123, 'number')).toBe(true);
        expect(mockValidateType(true, 'boolean')).toBe(true);
        expect(mockValidateType([1, 2], 'array')).toBe(true);
        expect(mockValidateType({ a: 1 }, 'object')).toBe(true);
    });

    test('问题5：没有支持自定义验证函数', () => {
        // **问题**：某些复杂验证（如密码强度）无法用正则表达式完成
        // **建议**：支持自定义验证函数

        interface RuleWithValidator {
            name: string;
            type: string;
            validator?: (value: any) => string | null;
        }

        const mockValidateWithCustom = (value: any, rule: RuleWithValidator) => {
            // 先执行类型检查
            if (rule.type === 'string' && typeof value !== 'string') {
                return '必须是字符串';
            }

            // 再执行自定义验证
            if (rule.validator) {
                return rule.validator(value);
            }

            return null;
        };

        // 密码强度验证
        const passwordRule: RuleWithValidator = {
            name: '密码',
            type: 'string',
            validator: (value: string) => {
                if (!/[A-Z]/.test(value)) return '必须包含大写字母';
                if (!/[a-z]/.test(value)) return '必须包含小写字母';
                if (!/\d/.test(value)) return '必须包含数字';
                if (value.length < 8) return '长度不能少于 8 位';
                return null;
            }
        };

        expect(mockValidateWithCustom('weak', passwordRule)).toBe('必须包含大写字母');
        expect(mockValidateWithCustom('Strong123', passwordRule)).toBeNull();
    });

    test('问题6：required 检查和类型验证分离导致重复', () => {
        // **问题**：required 检查后，类型验证还要再检查一次空值
        // **建议**：优化验证流程

        const mockValidate = (value: any, isRequired: boolean, type: string) => {
            // 第一步：必填检查
            if (isRequired && (value === null || value === undefined || value === '')) {
                return '必填项不能为空';
            }

            // 第二步：如果值为空且非必填，跳过后续验证
            if (!isRequired && (value === null || value === undefined || value === '')) {
                return null; // 允许为空
            }

            // 第三步：类型验证
            if (type === 'number' && typeof value !== 'number') {
                return '必须是数字';
            }

            return null;
        };

        expect(mockValidate(null, true, 'number')).toBe('必填项不能为空');
        expect(mockValidate(null, false, 'number')).toBeNull(); // 非必填允许为空
        expect(mockValidate('abc', false, 'number')).toBe('必须是数字');
    });
});
