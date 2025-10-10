/**
 * XML 解析器 - TypeScript 版本
 * 将 XML 字符串解析为 JSON 对象
 */

import type { XmlParseOptions } from '../types/xml';

/**
 * 解析结果接口（内部使用）
 */
interface ParseResult {
    value: Record<string, any>;
    end: number;
}

/**
 * XML 解析器类
 */
export class Xml {
    private options: Required<XmlParseOptions>;

    /**
     * 构造函数
     * @param options - 解析选项
     */
    constructor(options: XmlParseOptions = {}) {
        // 默认配置
        this.options = {
            ignoreAttributes: false,
            attributePrefix: '@',
            textKey: '#text',
            trimValues: true,
            parseBooleans: true,
            parseNumbers: true,
            customParser: true,
            ...options
        };
    }

    /**
     * 解析 XML 字符串为 JSON 对象
     * @param xmlData - XML 字符串
     * @returns 解析后的 JSON 对象
     */
    parse(xmlData: string): Record<string, any> {
        if (typeof xmlData !== 'string') {
            throw new Error('无效的 XML 数据');
        }

        if (xmlData.trim() === '') {
            throw new Error('XML 数据必须是非空字符串');
        }

        // 移除 XML 声明和注释
        xmlData = xmlData
            .replace(/<\?xml[^>]*\?>/g, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .trim();

        if (!xmlData) {
            throw new Error('XML 数据必须是非空字符串');
        }

        // 自定义解析
        if (this.options.customParser) {
            return this.customParse(xmlData);
        }

        return {};
    }

    /**
     * 解析属性字符串
     * @param attributesStr - 属性字符串
     * @param element - 元素对象
     */
    private parseAttributes(attributesStr: string, element: Record<string, any>): void {
        // 移除标签名，只保留属性部分
        const attrPart = attributesStr.replace(/^\w+\s*/, '');
        const attrRegex = /(\w+)=["']([^"']*)["']/g;
        let match: RegExpExecArray | null;

        while ((match = attrRegex.exec(attrPart)) !== null) {
            const attrName = this.options.attributePrefix + match[1];
            const attrValue = match[2];

            // 某些属性名通常应该保持为字符串（如ID）
            if (match[1].toLowerCase().includes('id') || match[1] === 'key' || match[1] === 'ref') {
                element[attrName] = attrValue;
            } else {
                // 其他属性进行类型解析
                element[attrName] = this.parseValue(attrValue);
            }
        }
    }

    /**
     * 自定义解析方法
     * @param xmlData - XML 数据
     * @returns 解析结果
     */
    private customParse(xmlData: string): Record<string, any> {
        const result = this.parseXmlElement(xmlData, 0).value;

        // 如果结果只有一个根元素，返回该元素的内容
        const keys = Object.keys(result);
        if (keys.length === 1) {
            return result[keys[0]];
        }
        return result;
    }

    /**
     * 解析 XML 元素
     * @param xml - XML 字符串
     * @param start - 开始位置
     * @returns 包含解析结果和结束位置的对象
     */
    private parseXmlElement(xml: string, start: number): ParseResult {
        const tagStart = xml.indexOf('<', start);
        if (tagStart === -1) {
            return { value: {}, end: xml.length };
        }

        const tagEnd = xml.indexOf('>', tagStart);
        if (tagEnd === -1) {
            throw new Error('格式错误：未找到标签结束符');
        }

        const fullTag = xml.slice(tagStart + 1, tagEnd);
        const element: Record<string, any> = {};

        // 自闭合标签
        if (fullTag.endsWith('/')) {
            const tagName = fullTag.slice(0, -1).split(/\s+/)[0];
            if (!this.options.ignoreAttributes && fullTag.includes(' ')) {
                this.parseAttributes(fullTag.slice(0, -1), element);
            }
            return { value: { [tagName]: Object.keys(element).length > 0 ? element : '' }, end: tagEnd + 1 };
        }

        // 注释
        if (fullTag.startsWith('!--')) {
            const commentEnd = xml.indexOf('-->', tagEnd);
            if (commentEnd === -1) {
                throw new Error('格式错误：未找到注释结束符');
            }
            return this.parseXmlElement(xml, commentEnd + 3);
        }

        // CDATA
        if (fullTag.startsWith('![CDATA[')) {
            const cdataEnd = xml.indexOf(']]>', tagEnd);
            if (cdataEnd === -1) {
                throw new Error('格式错误：未找到 CDATA 结束符');
            }
            return this.parseXmlElement(xml, cdataEnd + 3);
        }

        const tagName = fullTag.split(/\s+/)[0];

        // 解析属性
        if (!this.options.ignoreAttributes && fullTag.includes(' ')) {
            this.parseAttributes(fullTag, element);
        }

        // 查找结束标签
        const endTag = `</${tagName}>`;
        const endTagStart = xml.indexOf(endTag, tagEnd + 1);

        if (endTagStart === -1) {
            throw new Error(`格式错误：未找到结束标签 ${endTag}`);
        }

        const content = xml.slice(tagEnd + 1, endTagStart);

        // 如果内容为空
        if (!content.trim()) {
            return { value: { [tagName]: Object.keys(element).length > 0 ? element : '' }, end: endTagStart + endTag.length };
        }

        // 如果没有子标签，直接解析文本
        if (!content.includes('<')) {
            const textValue = this.parseValue(content);
            if (Object.keys(element).length === 0) {
                return { value: { [tagName]: textValue }, end: endTagStart + endTag.length };
            } else {
                element[this.options.textKey] = textValue;
                return { value: { [tagName]: element }, end: endTagStart + endTag.length };
            }
        } else {
            // 解析子元素和混合内容
            let pos = 0;
            const texts: string[] = [];

            while (pos < content.length) {
                const nextTag = content.indexOf('<', pos);

                if (nextTag === -1) {
                    // 没有更多标签，剩余都是文本
                    const text = content.slice(pos).trim();
                    if (text) texts.push(text);
                    break;
                }

                // 处理标签前的文本
                if (nextTag > pos) {
                    const text = content.slice(pos, nextTag).trim();
                    if (text) texts.push(text);
                }

                // 解析子元素
                const childResult = this.parseXmlElement(content, nextTag);
                const childObj = childResult.value;

                // 合并子元素到当前元素
                for (const [key, value] of Object.entries(childObj)) {
                    this.addElement(element, key, value);
                }

                pos = childResult.end;
            }

            // 合并文本内容
            if (texts.length > 0) {
                const combinedText = texts.join(' ');
                if (Object.keys(element).length === 0) {
                    return { value: { [tagName]: this.parseValue(combinedText) }, end: endTagStart + endTag.length };
                } else {
                    element[this.options.textKey] = this.parseValue(combinedText);
                }
            }

            return { value: { [tagName]: element }, end: endTagStart + endTag.length };
        }
    }

    /**
     * 添加元素到对象
     * @param parent - 父对象
     * @param name - 元素名
     * @param value - 元素值
     */
    private addElement(parent: Record<string, any>, name: string, value: any): void {
        if (parent[name] === undefined) {
            parent[name] = value;
        } else if (Array.isArray(parent[name])) {
            parent[name].push(value);
        } else {
            parent[name] = [parent[name], value];
        }
    }

    /**
     * 解析值的类型
     * @param value - 原始值
     * @returns 解析后的值
     */
    private parseValue(value: string): string | number | boolean {
        if (!value || typeof value !== 'string') {
            return value;
        }

        // 去除首尾空格
        if (this.options.trimValues) {
            value = value.trim();
        }

        // 解析布尔值
        if (this.options.parseBooleans) {
            if (value === 'true') return true;
            if (value === 'false') return false;
        }

        // 解析数字
        if (this.options.parseNumbers) {
            // 整数
            if (/^-?\d+$/.test(value)) {
                const num = parseInt(value, 10);
                if (num.toString() === value) {
                    return num;
                }
            }
            // 浮点数
            if (/^-?\d*\.\d+$/.test(value)) {
                const num = parseFloat(value);
                if (!isNaN(num)) {
                    return num;
                }
            }
            // 科学计数法
            if (/^-?\d*\.?\d+e[+-]?\d+$/i.test(value)) {
                const num = parseFloat(value);
                if (!isNaN(num)) {
                    return num;
                }
            }
        }

        // 处理 XML 实体
        return this.decodeEntities(value);
    }

    /**
     * 解码 XML 实体
     * @param value - 包含实体的字符串
     * @returns 解码后的字符串
     */
    private decodeEntities(value: string): string {
        const entities: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&apos;': "'"
        };

        return value.replace(/&[^;]+;/g, (entity) => {
            return entities[entity] || entity;
        });
    }

    /**
     * 静态方法：快速解析 XML
     * @param xmlData - XML 数据
     * @param options - 解析选项
     * @returns 解析后的 JSON 对象
     */
    static parse(xmlData: string, options: XmlParseOptions = {}): Record<string, any> {
        const parser = new Xml(options);
        return parser.parse(xmlData);
    }

    /**
     * 静态方法：解析 XML 并保留属性
     * @param xmlData - XML 数据
     * @returns 解析后的 JSON 对象
     */
    static parseWithAttributes(xmlData: string): Record<string, any> {
        return Xml.parse(xmlData, { ignoreAttributes: false });
    }

    /**
     * 静态方法：解析 XML 并忽略属性
     * @param xmlData - XML 数据
     * @returns 解析后的 JSON 对象
     */
    static parseIgnoreAttributes(xmlData: string): Record<string, any> {
        return Xml.parse(xmlData, { ignoreAttributes: true });
    }

    /**
     * 静态方法：验证 XML 格式
     * @param xmlData - XML 数据
     * @returns 是否有效
     */
    static validate(xmlData: string): boolean {
        try {
            Xml.parse(xmlData);
            return true;
        } catch (error) {
            return false;
        }
    }
}
