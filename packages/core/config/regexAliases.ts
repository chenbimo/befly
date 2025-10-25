/**
 * 内置正则表达式别名
 *
 * 使用方式：在字段定义的 regex 位置使用 @别名 格式
 * 例如：'字段名|array_text|null|null|null|0|@number'
 */

export const RegexAliases = {
    // 数字类型
    number: '^\\d+$', // 纯数字
    integer: '^-?\\d+$', // 整数（含负数）
    float: '^-?\\d+(\\.\\d+)?$', // 浮点数
    positive: '^[1-9]\\d*$', // 正整数（不含0）

    // 字符串类型
    word: '^[a-zA-Z]+$', // 纯字母
    alphanumeric: '^[a-zA-Z0-9]+$', // 字母+数字
    alphanumeric_: '^[a-zA-Z0-9_]+$', // 字母+数字+下划线
    lowercase: '^[a-z]+$', // 小写字母
    uppercase: '^[A-Z]+$', // 大写字母

    // 中文
    chinese: '^[\\u4e00-\\u9fa5]+$', // 纯中文
    chinese_word: '^[\\u4e00-\\u9fa5a-zA-Z]+$', // 中文+字母

    // 常用格式
    email: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', // 邮箱
    phone: '^1[3-9]\\d{9}$', // 中国手机号
    url: '^https?://', // URL
    ip: '^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$', // IPv4

    // 特殊格式
    uuid: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', // UUID
    hex: '^[0-9a-fA-F]+$', // 十六进制
    base64: '^[A-Za-z0-9+/=]+$', // Base64

    // 日期时间
    date: '^\\d{4}-\\d{2}-\\d{2}$', // YYYY-MM-DD
    time: '^\\d{2}:\\d{2}:\\d{2}$', // HH:MM:SS
    datetime: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}', // ISO 8601

    // 代码相关
    variable: '^[a-zA-Z_][a-zA-Z0-9_]*$', // 变量名
    constant: '^[A-Z][A-Z0-9_]*$', // 常量名（大写）

    // 空值
    empty: '^$', // 空字符串
    notempty: '.+' // 非空
} as const;

export type RegexAliasName = keyof typeof RegexAliases;
