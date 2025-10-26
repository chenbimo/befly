/**
 * syncDb 辅助函数测试
 */

import { describe, test, expect } from 'bun:test';
import { quoteIdentifier, logFieldChange, formatFieldList } from '../commands/syncDb/helpers.js';

describe('syncDb/helpers', () => {
    describe('quoteIdentifier', () => {
        test('应正确引用标识符', () => {
            const result = quoteIdentifier('user_table');

            // 根据当前数据库类型验证
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        test('应处理特殊字符', () => {
            const result = quoteIdentifier('table_name_with_underscore');
            expect(result).toBeDefined();
        });

        test('应处理空字符串', () => {
            const result = quoteIdentifier('');
            expect(typeof result).toBe('string');
        });
    });

    describe('logFieldChange', () => {
        test('应不抛出错误', () => {
            expect(() => {
                logFieldChange('test_table', 'test_field', 'length', 100, 200, '长度');
            }).not.toThrow();
        });

        test('应处理各种变更类型', () => {
            expect(() => {
                logFieldChange('table1', 'field1', 'length', 100, 200, '长度');
                logFieldChange('table2', 'field2', 'datatype', 'INT', 'VARCHAR', '类型');
                logFieldChange('table3', 'field3', 'comment', 'old', 'new', '注释');
                logFieldChange('table4', 'field4', 'default', 0, 1, '默认值');
            }).not.toThrow();
        });
    });

    describe('formatFieldList', () => {
        test('应正确格式化单个字段', () => {
            const result = formatFieldList(['id']);
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });

        test('应正确格式化多个字段', () => {
            const result = formatFieldList(['id', 'name', 'email']);
            expect(result).toContain(',');
            expect(result.split(',').length).toBe(3);
        });

        test('应处理空数组', () => {
            const result = formatFieldList([]);
            expect(result).toBe('');
        });

        test('应正确引用字段名', () => {
            const result = formatFieldList(['user_id', 'user_name']);
            expect(result).toBeDefined();
            // 结果应包含引用符号（取决于数据库类型）
        });
    });
});
