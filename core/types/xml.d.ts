/**
 * XML 工具类型定义
 */

/**
 * XML 解析选项
 */
export interface XmlParseOptions {
    /** 是否忽略属性 */
    ignoreAttributes?: boolean;
    /** 属性前缀 */
    attributePrefix?: string;
    /** 文本内容的键名 */
    textKey?: string;
    /** 是否去除首尾空格 */
    trimValues?: boolean;
    /** 是否解析布尔值 */
    parseBooleans?: boolean;
    /** 是否解析数字 */
    parseNumbers?: boolean;
    /** 是否使用自定义解析器 */
    customParser?: boolean;
}

/**
 * XML 构建选项
 */
export interface XmlBuildOptions {
    /** 根元素名称 */
    rootName?: string;
    /** 是否格式化输出 */
    format?: boolean;
    /** 缩进空格数 */
    indent?: number;
    /** XML 声明 */
    declaration?: boolean;
    /** 编码格式 */
    encoding?: string;
}
