import { describe, expect, test } from 'bun:test';

describe('字段规则分割（使用字符串.split("⚡")）', () => {
    test('分割应返回7个部分（典型示例）', () => {
        const rule = '用户名⚡string⚡2⚡50⚡匿名用户⚡1⚡^.+$';
        const parts = rule.split('⚡');
        expect(parts.length).toBe(7);
        expect(parts).toEqual(['用户名', 'string', '2', '50', '匿名用户', '1', '^.+$']);
    });

    test('保持空字符串段与字面量 null/undefined', () => {
        const rule = 'a⚡string⚡⚡⚡null⚡0⚡undefined';
        const parts = rule.split('⚡');
        expect(parts.length).toBe(7);
        // 第3、4段为空字符串
        expect(parts[2]).toBe('');
        expect(parts[3]).toBe('');
        // 第5段为字面字符串 "null"，第7段为字面字符串 "undefined"
        expect(parts[4]).toBe('null');
        expect(parts[6]).toBe('undefined');
    });

    test('分隔符数量变化将直接影响结果长度（不进行验证）', () => {
        expect('a⚡b'.split('⚡').length).toBe(2);
        expect('a⚡⚡c'.split('⚡')).toEqual(['a', '', 'c']);
        expect('a⚡b⚡c⚡d⚡e⚡f⚡g⚡h'.split('⚡').length).toBe(8);
    });

    test('不对内容做额外解析或正则校验', () => {
        const rule = 'name⚡string⚡0⚡100⚡default⚡1⚡[invalid';
        const parts = rule.split('⚡');
        // 即使第7段不是合法正则，也只是普通字符串
        expect(parts[6]).toBe('[invalid');
    });
});
