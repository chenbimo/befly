/**
 * 内置正则表达式别名
 * 用于表单验证和数据校验
 * 命名规范：小驼峰格式
 */
export declare const RegexAliases: {
    /** 正整数（不含0） */
    readonly number: "^\\d+$";
    /** 整数（含负数） */
    readonly integer: "^-?\\d+$";
    /** 浮点数 */
    readonly float: "^-?\\d+(\\.\\d+)?$";
    /** 正整数（不含0） */
    readonly positive: "^[1-9]\\d*$";
    /** 负整数 */
    readonly negative: "^-\\d+$";
    /** 零 */
    readonly zero: "^0$";
    /** 纯字母 */
    readonly word: "^[a-zA-Z]+$";
    /** 字母和数字 */
    readonly alphanumeric: "^[a-zA-Z0-9]+$";
    /** 字母、数字和下划线 */
    readonly alphanumeric_: "^[a-zA-Z0-9_]+$";
    /** 字母、数字、下划线和短横线 */
    readonly alphanumericDash_: "^[a-zA-Z0-9_-]+$";
    /** 小写字母 */
    readonly lowercase: "^[a-z]+$";
    /** 大写字母 */
    readonly uppercase: "^[A-Z]+$";
    /** 纯中文 */
    readonly chinese: "^[\\u4e00-\\u9fa5]+$";
    /** 中文和字母 */
    readonly chineseWord: "^[\\u4e00-\\u9fa5a-zA-Z]+$";
    /** 邮箱地址 */
    readonly email: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$";
    /** 中国大陆手机号 */
    readonly phone: "^1[3-9]\\d{9}$";
    /** 固定电话（区号-号码） */
    readonly telephone: "^0\\d{2,3}-?\\d{7,8}$";
    /** URL 地址 */
    readonly url: "^https?://";
    /** IPv4 地址 */
    readonly ip: "^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$";
    /** IPv6 地址 */
    readonly ipv6: "^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$";
    /** 域名 */
    readonly domain: "^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$";
    /** UUID */
    readonly uuid: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
    /** 十六进制字符串 */
    readonly hex: "^[0-9a-fA-F]+$";
    /** Base64 编码 */
    readonly base64: "^[A-Za-z0-9+/=]+$";
    /** MD5 哈希 */
    readonly md5: "^[a-f0-9]{32}$";
    /** SHA1 哈希 */
    readonly sha1: "^[a-f0-9]{40}$";
    /** SHA256 哈希 */
    readonly sha256: "^[a-f0-9]{64}$";
    /** 日期 YYYY-MM-DD */
    readonly date: "^\\d{4}-\\d{2}-\\d{2}$";
    /** 时间 HH:MM:SS */
    readonly time: "^\\d{2}:\\d{2}:\\d{2}$";
    /** ISO 日期时间 */
    readonly datetime: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}";
    /** 年份 */
    readonly year: "^\\d{4}$";
    /** 月份 01-12 */
    readonly month: "^(0[1-9]|1[0-2])$";
    /** 日期 01-31 */
    readonly day: "^(0[1-9]|[12]\\d|3[01])$";
    /** 变量名 */
    readonly variable: "^[a-zA-Z_][a-zA-Z0-9_]*$";
    /** 常量名（全大写） */
    readonly constant: "^[A-Z][A-Z0-9_]*$";
    /** 包名（小写+连字符） */
    readonly package: "^[a-z][a-z0-9-]*$";
    /** 中国身份证号（18位） */
    readonly idCard: "^\\d{17}[\\dXx]$";
    /** 护照号 */
    readonly passport: "^[a-zA-Z0-9]{5,17}$";
    /** 银行卡号（16-19位数字） */
    readonly bankCard: "^\\d{16,19}$";
    /** 微信号（6-20位，字母开头，可包含字母、数字、下划线、减号） */
    readonly wechat: "^[a-zA-Z][a-zA-Z0-9_-]{5,19}$";
    /** QQ号（5-11位数字，首位非0） */
    readonly qq: "^[1-9]\\d{4,10}$";
    /** 支付宝账号（手机号或邮箱） */
    readonly alipay: "^(1[3-9]\\d{9}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})$";
    /** 用户名（4-20位，字母开头，可包含字母、数字、下划线） */
    readonly username: "^[a-zA-Z][a-zA-Z0-9_]{3,19}$";
    /** 昵称（2-20位，支持中文、字母、数字） */
    readonly nickname: "^[\\u4e00-\\u9fa5a-zA-Z0-9]{2,20}$";
    /** 弱密码（至少6位） */
    readonly passwordWeak: "^.{6,}$";
    /** 中等密码（至少8位，包含字母和数字） */
    readonly passwordMedium: "^(?=.*[a-zA-Z])(?=.*\\d).{8,}$";
    /** 强密码（至少8位，包含大小写字母、数字和特殊字符） */
    readonly passwordStrong: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*]).{8,}$";
    /** 车牌号（新能源+普通） */
    readonly licensePlate: "^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]$";
    /** 邮政编码 */
    readonly postalCode: "^\\d{6}$";
    /** 版本号（语义化版本） */
    readonly semver: "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.]+)?(\\+[a-zA-Z0-9.]+)?$";
    /** 颜色值（十六进制） */
    readonly colorHex: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$";
    /** 空字符串 */
    readonly empty: "^$";
    /** 非空 */
    readonly notempty: ".+";
};
/**
 * 正则别名类型
 */
export type RegexAliasName = keyof typeof RegexAliases;
/**
 * 获取正则表达式字符串
 * @param name 正则别名（以 @ 开头）或自定义正则字符串
 * @returns 正则表达式字符串
 */
export declare function getRegex(name: string): string;
/**
 * 获取编译后的正则表达式对象（带缓存）
 * @param pattern 正则别名或正则字符串
 * @param flags 正则标志（如 'i', 'g'）
 * @returns 编译后的 RegExp 对象
 */
export declare function getCompiledRegex(pattern: string, flags?: string): RegExp;
/**
 * 验证值是否匹配正则（使用缓存）
 * @param value 要验证的值
 * @param pattern 正则别名或正则字符串
 * @returns 是否匹配
 */
export declare function matchRegex(value: string, pattern: string): boolean;
/**
 * 清除正则缓存
 */
export declare function clearRegexCache(): void;
/**
 * 获取缓存大小
 */
export declare function getRegexCacheSize(): number;
