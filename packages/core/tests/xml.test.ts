import { describe, test, expect } from 'bun:test';
import { Xml } from '../lib/xml';

describe('Xml - 基本解析', () => {
    test('解析简单元素', () => {
        const xml = new Xml();
        const result = xml.parse('<root>Hello</root>');
        expect(result).toBe('Hello');
    });

    test('解析嵌套元素', () => {
        const xml = new Xml();
        const result = xml.parse('<root><child>Value</child></root>');
        expect(result).toEqual({ child: 'Value' });
    });

    test('解析多个同名元素', () => {
        const xml = new Xml();
        const result = xml.parse('<root><item>A</item><item>B</item></root>');
        expect(result).toEqual({ item: ['A', 'B'] });
    });

    test('解析空元素', () => {
        const xml = new Xml();
        const result = xml.parse('<root></root>');
        expect(result).toBe('');
    });

    test('解析自闭合标签', () => {
        const xml = new Xml();
        const result = xml.parse('<root><item/></root>');
        expect(result).toEqual({ item: '' });
    });
});

describe('Xml - 属性解析', () => {
    test('解析元素属性', () => {
        const xml = new Xml();
        const result = xml.parse('<root id="1">Value</root>') as any;
        expect(result['@id']).toBe('1');
        expect(result['#text']).toBe('Value');
    });

    test('解析多个属性', () => {
        const xml = new Xml();
        const result = xml.parse('<user id="123" name="John">Content</user>') as any;
        expect(result['@id']).toBe('123');
        expect(result['@name']).toBe('John');
        expect(result['#text']).toBe('Content');
    });

    test('忽略属性', () => {
        const xml = new Xml({ ignoreAttributes: true });
        const result = xml.parse('<root id="1">Value</root>');
        expect(result).toBe('Value');
    });
});

describe('Xml - 数值解析', () => {
    test('自动解析数字', () => {
        const xml = new Xml();
        const result = xml.parse('<root>123</root>');
        expect(result).toBe(123);
    });

    test('自动解析布尔值', () => {
        const xml = new Xml();
        const result1 = xml.parse('<root>true</root>');
        const result2 = xml.parse('<root>false</root>');
        expect(result1).toBe(true);
        expect(result2).toBe(false);
    });

    test('禁用数字解析', () => {
        const xml = new Xml({ parseNumbers: false });
        const result = xml.parse('<root>123</root>');
        expect(result).toBe('123');
    });
});

describe('Xml - 错误处理', () => {
    test('拒绝非字符串输入', () => {
        const xml = new Xml();
        expect(() => xml.parse(123 as any)).toThrow('无效的 XML 数据');
    });

    test('拒绝空字符串', () => {
        const xml = new Xml();
        expect(() => xml.parse('')).toThrow('非空字符串');
    });

    test('拒绝只有空格的字符串', () => {
        const xml = new Xml();
        expect(() => xml.parse('   ')).toThrow('非空字符串');
    });

    test('检测未闭合标签', () => {
        const xml = new Xml();
        expect(() => xml.parse('<root><item>')).toThrow('未找到结束标签');
    });
});
