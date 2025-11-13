/**
 * 内置正则表达式别名（Befly 项目专用）
 */
export const RegexAliases = {
    // 数字类型
    number: '^\\d+$',
    integer: '^-?\\d+$',
    float: '^-?\\d+(\\.\\d+)?$',
    positive: '^[1-9]\\d*$',
    negative: '^-\\d+$',
    zero: '^0$',

    // 字符串类型
    word: '^[a-zA-Z]+$',
    alphanumeric: '^[a-zA-Z0-9]+$',
    alphanumeric_: '^[a-zA-Z0-9_]+$',
    lowercase: '^[a-z]+$',
    uppercase: '^[A-Z]+$',

    // 中文
    chinese: '^[\\u4e00-\\u9fa5]+$',
    chinese_word: '^[\\u4e00-\\u9fa5a-zA-Z]+$',

    // 常用格式
    email: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    phone: '^1[3-9]\\d{9}$',
    url: '^https?://',
    ip: '^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$',
    domain: '^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$',

    // 特殊格式
    uuid: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    hex: '^[0-9a-fA-F]+$',
    base64: '^[A-Za-z0-9+/=]+$',
    md5: '^[a-f0-9]{32}$',
    sha1: '^[a-f0-9]{40}$',
    sha256: '^[a-f0-9]{64}$',

    // 日期时间
    date: '^\\d{4}-\\d{2}-\\d{2}$',
    time: '^\\d{2}:\\d{2}:\\d{2}$',
    datetime: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
    year: '^\\d{4}$',
    month: '^(0[1-9]|1[0-2])$',
    day: '^(0[1-9]|[12]\\d|3[01])$',

    // 代码相关
    variable: '^[a-zA-Z_][a-zA-Z0-9_]*$',
    constant: '^[A-Z][A-Z0-9_]*$',
    package: '^[a-z][a-z0-9-]*$',

    // 证件相关
    id_card: '^\\d{17}[\\dXx]$',
    passport: '^[a-zA-Z0-9]{5,17}$',

    // 空值
    empty: '^$',
    notempty: '.+'
} as const;
