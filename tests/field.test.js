import { describe, expect, test } from 'bun:test';
import { parseFieldRule } from '../utils/util.js';

describe('字段属性验证规则测试', () => {
    test('字段规则必须包含7个部分', () => {
        // 少于7个部分应该抛出错误
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0')).toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null')).toThrow();
        expect(() => parseFieldRule('用户名⚡string')).toThrow();

        // 多于7个部分应该抛出错误
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡null⚡extra')).toThrow();

        // 正好7个部分应该通过
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
    });

    test('第1个值：名称可包含中文、数字、字母、空格、下划线、短横线', () => {
        // 有效的名称
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('username⚡string⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('用户名 123⚡string⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('user_name⚡string⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('user-name⚡string⚡null⚡null⚡null⚡0⚡null')).not.toThrow();

        // 无效的名称
        expect(() => parseFieldRule('user@name⚡string⚡null⚡null⚡null⚡0⚡null')).toThrow();
    });

    test('第2个值：字段类型必须为string,number,text,array之一', () => {
        // 有效的类型
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('年龄⚡number⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('描述⚡text⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('标签⚡array⚡null⚡null⚡null⚡0⚡null')).not.toThrow();

        // 无效的类型
        expect(() => parseFieldRule('用户名⚡varchar⚡null⚡null⚡null⚡0⚡null')).toThrow();
        expect(() => parseFieldRule('用户名⚡int⚡null⚡null⚡null⚡0⚡null')).toThrow();
        expect(() => parseFieldRule('用户名⚡longtext⚡null⚡null⚡null⚡0⚡null')).toThrow();
        expect(() => parseFieldRule('用户名⚡json⚡null⚡null⚡null⚡0⚡null')).toThrow();
    });

    test('第3个值：最小值必须为null或数字', () => {
        // 有效的最小值
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡0⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡10⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡-5⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡3.14⚡null⚡null⚡0⚡null')).not.toThrow();

        // 无效的最小值
        expect(() => parseFieldRule('用户名⚡string⚡abc⚡null⚡null⚡0⚡null')).toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡undefined⚡null⚡null⚡0⚡null')).toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡⚡null⚡null⚡0⚡null')).toThrow();
    });

    test('第4个值：最大值必须为null或数字', () => {
        // 有效的最大值
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡100⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡-10⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡99.99⚡null⚡0⚡null')).not.toThrow();

        // 无效的最大值
        expect(() => parseFieldRule('用户名⚡string⚡null⚡xyz⚡null⚡0⚡null')).toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡undefined⚡null⚡0⚡null')).toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡⚡null⚡0⚡null')).toThrow();
    });

    test('第5个值：默认值必须为null、字符串或数字', () => {
        // 有效的默认值
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡defaultValue⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('年龄⚡number⚡null⚡null⚡18⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('分数⚡number⚡null⚡null⚡95.5⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('状态⚡string⚡null⚡null⚡active⚡0⚡null')).not.toThrow();

        // 所有字符串类型的默认值都应该被接受
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡⚡0⚡null')).not.toThrow(); // 空字符串
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡test value⚡0⚡null')).not.toThrow(); // 包含空格
    });

    test('第6个值：是否创建索引必须为0或1', () => {
        // 有效的索引标识
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡1⚡null')).not.toThrow();

        // 无效的索引标识
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡null⚡null')).toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡2⚡null')).toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡yes⚡null')).toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡true⚡null')).toThrow();
    });

    test('基础正则表达式验证', () => {
        // 有效的正则约束
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('邮箱⚡string⚡null⚡null⚡null⚡0⚡^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$')).not.toThrow();
        expect(() => parseFieldRule('手机⚡string⚡null⚡null⚡null⚡0⚡^1[3-9]\\d{9}$')).not.toThrow();
        expect(() => parseFieldRule('状态⚡string⚡null⚡null⚡null⚡0⚡^(active|inactive|pending)$')).not.toThrow();

        // 无效的正则约束
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡[invalid')).toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡*invalid')).toThrow();
        expect(() => parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡?invalid')).toThrow();
    });

    test('完整的字段定义示例', () => {
        // 真实场景的完整示例
        expect(() => parseFieldRule('用户名⚡string⚡2⚡50⚡匿名用户⚡1⚡^[\\u4e00-\\u9fa5a-zA-Z0-9]+$')).not.toThrow();
        expect(() => parseFieldRule('年龄⚡number⚡0⚡120⚡18⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('邮箱⚡string⚡null⚡255⚡null⚡1⚡^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$')).not.toThrow();
        expect(() => parseFieldRule('状态⚡string⚡null⚡null⚡active⚡1⚡^(active|inactive|pending)$')).not.toThrow();
        expect(() => parseFieldRule('描述⚡text⚡null⚡null⚡null⚡0⚡null')).not.toThrow();
        expect(() => parseFieldRule('标签⚡array⚡null⚡null⚡[]⚡0⚡null')).not.toThrow();
    });

    test('错误消息的准确性', () => {
        // 测试错误消息是否准确描述问题
        try {
            parseFieldRule('user-name⚡string⚡null⚡null⚡null⚡0⚡null');
        } catch (error) {
            expect(error.message).toContain('字段名称');
            expect(error.message).toContain('必须为中文、数字、字母');
        }

        try {
            parseFieldRule('用户名⚡varchar⚡null⚡null⚡null⚡0⚡null');
        } catch (error) {
            expect(error.message).toContain('字段类型');
            expect(error.message).toContain('必须为string、number、text、array之一');
        }

        try {
            parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡2⚡null');
        } catch (error) {
            expect(error.message).toContain('索引标识');
            expect(error.message).toContain('必须为0或1');
        }

        try {
            parseFieldRule('用户名⚡string⚡null⚡null⚡null⚡0⚡[invalid');
        } catch (error) {
            expect(error.message).toContain('正则约束');
            expect(error.message).toContain('必须为null或有效的正则表达式');
        }
    });
});
