// XML 解析器测试套件
import { describe, test, expect } from 'bun:test';
import { Xml } from '../libs/xml.js';

describe('XML 解析器测试', () => {
    // === 1. 基础解析功能测试 ===
    describe('基础解析功能', () => {
        test('解析简单 XML 元素', () => {
            const xml = '<root><name>测试</name><age>25</age></root>';
            const result = Xml.parse(xml);

            expect(result.name).toBe('测试');
            expect(result.age).toBe(25);
        });

        test('解析带属性的 XML', () => {
            const xml = '<person id="123" active="true"><name>张三</name></person>';
            const result = Xml.parseWithAttributes(xml);

            expect(result['@id']).toBe('123');
            expect(result['@active']).toBe(true);
            expect(result.name).toBe('张三');
        });

        test('解析嵌套 XML 结构', () => {
            const xml = '<company><department name="技术部"><employee><name>李四</name></employee></department></company>';
            const result = Xml.parseWithAttributes(xml);

            expect(result.department['@name']).toBe('技术部');
            expect(result.department.employee.name).toBe('李四');
        });

        test('解析多个同名元素', () => {
            const xml = '<products><item>产品1</item><item>产品2</item><item>产品3</item></products>';
            const result = Xml.parse(xml);

            expect(Array.isArray(result.item)).toBe(true);
            expect(result.item).toHaveLength(3);
            expect(result.item[0]).toBe('产品1');
            expect(result.item[1]).toBe('产品2');
            expect(result.item[2]).toBe('产品3');
        });

        test('解析空元素', () => {
            const xml = '<config><debug/><verbose></verbose></config>';
            const result = Xml.parse(xml);

            expect(result.debug).toBe('');
            expect(result.verbose).toBe('');
        });
    });

    // === 2. 数据类型解析测试 ===
    describe('数据类型解析', () => {
        test('解析数字类型', () => {
            const xml = '<data><int>42</int><float>3.14</float><negative>-123</negative></data>';
            const result = Xml.parse(xml);

            expect(result.int).toBe(42);
            expect(result.float).toBe(3.14);
            expect(result.negative).toBe(-123);
        });

        test('解析布尔值', () => {
            const xml = '<settings><enabled>true</enabled><disabled>false</disabled></settings>';
            const result = Xml.parse(xml);

            expect(result.enabled).toBe(true);
            expect(result.disabled).toBe(false);
        });

        test('解析字符串值', () => {
            const xml = '<text><simple>Hello</simple><chinese>中文测试</chinese></text>';
            const result = Xml.parse(xml);

            expect(result.simple).toBe('Hello');
            expect(result.chinese).toBe('中文测试');
        });
    });

    // === 3. 特殊情况处理测试 ===
    describe('特殊情况处理', () => {
        test('处理 XML 实体', () => {
            const xml = '<text>&lt;tag&gt; &amp; &quot;quoted&quot;</text>';
            const result = Xml.parse(xml);

            expect(result).toBe('<tag> & "quoted"');
        });

        test('解析自闭合标签', () => {
            const xml = '<config><item key="value1"/><item key="value2"/></config>';
            const result = Xml.parseWithAttributes(xml);

            expect(Array.isArray(result.item)).toBe(true);
            expect(result.item[0]['@key']).toBe('value1');
            expect(result.item[1]['@key']).toBe('value2');
        });

        test('处理混合内容', () => {
            const xml = '<mixed>文本<child>子元素</child>更多文本</mixed>';
            const result = Xml.parse(xml);

            expect(result.child).toBe('子元素');
            expect(result['#text']).toContain('文本');
        });
    });

    // === 4. 配置选项测试 ===
    describe('配置选项测试', () => {
        test('忽略属性选项', () => {
            const xml = '<person id="123"><name>张三</name></person>';
            const result = Xml.parseIgnoreAttributes(xml);

            expect(result['@id']).toBeUndefined();
            expect(result.name).toBe('张三');
        });

        test('自定义属性前缀', () => {
            const xml = '<element attr="value">内容</element>';
            const result = Xml.parse(xml, { attributePrefix: 'attr_' });

            expect(result['attr_attr']).toBe('value');
        });

        test('禁用类型解析', () => {
            const xml = '<data><number>123</number><bool>true</bool></data>';
            const result = Xml.parse(xml, { parseNumbers: false, parseBooleans: false });

            expect(result.number).toBe('123');
            expect(result.bool).toBe('true');
        });
    });

    // === 5. 错误处理测试 ===
    describe('错误处理', () => {
        test('处理空 XML 数据', () => {
            expect(() => Xml.parse('')).toThrow('XML 数据必须是非空字符串');
            expect(() => Xml.parse(null)).toThrow('无效的 XML 数据');
        });

        test('处理格式错误的 XML', () => {
            const invalidXml = '<root><unclosed>内容</root>';
            expect(() => Xml.parse(invalidXml)).toThrow();
        });
    });

    // === 6. 静态方法测试 ===
    describe('静态方法测试', () => {
        test('XML 验证功能', () => {
            const validXml = '<root><child>内容</child></root>';
            const invalidXml = '<root><child>内容</root>';

            expect(Xml.validate(validXml)).toBe(true);
            expect(Xml.validate(invalidXml)).toBe(false);
        });

        test('实例方法', () => {
            const parser = new Xml({ ignoreAttributes: true });
            const xml = '<test attr="value">内容</test>';
            const result = parser.parse(xml);

            expect(result).toBe('内容');
            expect(result['@attr']).toBeUndefined();
        });
    });

    // === 7. 性能测试 ===
    describe('性能测试', () => {
        test('解析大型 XML 文档', () => {
            // 生成包含100个元素的XML
            let largeXml = '<items>';
            for (let i = 0; i < 100; i++) {
                largeXml += `<item id="${i}">项目${i}</item>`;
            }
            largeXml += '</items>';

            const startTime = Date.now();
            const result = Xml.parseWithAttributes(largeXml);
            const endTime = Date.now();

            const parseTime = endTime - startTime;
            console.log(`   ℹ️  大型XML解析性能: 100个元素耗时${parseTime}ms`);

            expect(Array.isArray(result.item)).toBe(true);
            expect(result.item).toHaveLength(100);
            expect(result.item[0]['@id']).toBe('0');
            expect(result.item[99]['@id']).toBe('99');

            // 性能要求：100个元素解析时间不超过50ms
            expect(parseTime).toBeLessThan(50);
        });
    });
});
