/**
 * 工具类型定义
 *
 * 这个文件定义了各种工具函数的类型
 */

/**
 * 加密相关类型
 */

/** 编码类型 */
export type EncodingType = 'hex' | 'base64' | 'base64url';

/** 哈希算法 */
export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512';

/** 密码哈希选项 */
export interface PasswordHashOptions {
    algorithm?: 'argon2id' | 'argon2i' | 'argon2d' | 'bcrypt' | 'scrypt';
    memoryCost?: number;
    timeCost?: number;
    [key: string]: any;
}

/**
 * 验证相关类型
 */

/** 字段类型 */
export type FieldType = 'string' | 'number' | 'text' | 'array';

/** 验证规则 */
export interface FieldRule {
    /** 显示名 */
    name: string;
    /** 字段类型 */
    type: FieldType;
    /** 最小值/长度 */
    min: number | null;
    /** 最大值/长度 */
    max: number | null;
    /** 默认值 */
    default: any;
    /** 是否索引 */
    index: 0 | 1;
    /** 正则约束 */
    regex: string | null;
}

/** 验证结果 */
export interface ValidationResult {
    /** 验证状态码：0=成功，1=失败 */
    code: 0 | 1;
    /** 字段验证结果 */
    fields: Record<string, any>;
}

/**
 * 日期格式化类型
 */
export type DateFormat = 'YYYY-MM-DD' | 'YYYY-MM-DD HH:mm:ss' | 'HH:mm:ss' | 'YYYY/MM/DD' | 'MM-DD' | string;

/**
 * API 工具类型
 */

/** API 方法 */
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';

/** API 认证配置 */
export type ApiAuth = boolean | string[];

/**
 * 数据库工具类型
 */

/** 数据库类型 */
export type DatabaseType = 'mysql' | 'postgresql' | 'sqlite';

/** 表名映射 */
export type TableNameMapping = Record<string, string>;

/**
 * Redis 工具类型
 */

/** Redis 键前缀 */
export type RedisKeyPrefix = string;

/** Redis TTL（秒） */
export type RedisTTL = number | null;

/**
 * 日志工具类型
 */

/** 日志级别 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'trace';

/** 日志消息 */
export type LogMessage = string | Record<string, any>;

/**
 * 文件工具类型
 */

/** 文件类型 */
export type FileType = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

/** MIME 类型 */
export type MimeType = string;

/** 文件上传选项 */
export interface FileUploadOptions {
    /** 允许的文件类型 */
    allowedTypes?: string[];
    /** 最大文件大小（字节） */
    maxSize?: number;
    /** 保存目录 */
    saveDir?: string;
    /** 文件名生成函数 */
    filename?: (originalName: string) => string;
}

/**
 * XML 工具类型
 */

/** XML 解析选项 */
export interface XmlParseOptions {
    /** 是否忽略属性 */
    ignoreAttributes?: boolean;
    /** 是否允许布尔属性 */
    allowBooleanAttributes?: boolean;
    /** 数组模式 */
    isArray?: (tagName: string) => boolean;
}

/** XML 构建选项 */
export interface XmlBuildOptions {
    /** 根节点名称 */
    rootName?: string;
    /** 是否格式化 */
    format?: boolean;
    /** 缩进字符串 */
    indent?: string;
}

/**
 * 颜色工具类型
 */

/** 颜色代码 */
export type ColorCode = 'reset' | 'bright' | 'dim' | 'underscore' | 'blink' | 'reverse' | 'hidden' | 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';

/**
 * 分页类型
 */

/** 分页参数 */
export interface PaginationParams {
    /** 页码（从 1 开始） */
    page?: number;
    /** 每页数量 */
    limit?: number;
}

/** 分页结果 */
export interface PaginationResult<T = any> {
    /** 数据列表 */
    list: T[];
    /** 总条数 */
    total: number;
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    limit: number;
    /** 总页数 */
    pages: number;
    /** 是否有下一页 */
    hasNext: boolean;
    /** 是否有上一页 */
    hasPrev: boolean;
}

/**
 * 错误类型
 */

/** 错误代码 */
export type ErrorCode = 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'AUTH_ERROR' | 'NOT_FOUND' | 'PERMISSION_DENIED' | 'INTERNAL_ERROR' | 'BAD_REQUEST' | string;

/** 应用错误 */
export interface AppError {
    /** 错误代码 */
    code: ErrorCode;
    /** 错误消息 */
    message: string;
    /** 错误详情 */
    details?: any;
    /** 堆栈信息 */
    stack?: string;
}

/**
 * 响应包装类型
 */

/** 成功响应 */
export interface SuccessResponse<T = any> {
    code: 0;
    msg: string;
    data: T;
}

/** 失败响应 */
export interface ErrorResponse {
    code: 1;
    msg: string;
    data: null | any;
}

/** 通用响应 */
export type Response<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * 类型守卫工具
 */

/** 判断是否为字符串 */
export type IsString<T> = T extends string ? true : false;

/** 判断是否为数字 */
export type IsNumber<T> = T extends number ? true : false;

/** 判断是否为数组 */
export type IsArray<T> = T extends any[] ? true : false;

/** 判断是否为对象 */
export type IsObject<T> = T extends object ? (T extends any[] ? false : true) : false;

/**
 * 实用工具类型
 */

/** 深度只读 */
export type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/** 深度可选 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** 非空类型 */
export type NonNullableFields<T> = {
    [P in keyof T]: NonNullable<T[P]>;
};

/** 提取函数参数类型 */
export type ExtractArgs<T> = T extends (...args: infer A) => any ? A : never;

/** 提取函数返回值类型 */
export type ExtractReturn<T> = T extends (...args: any[]) => infer R ? R : never;

/** 提取 Promise 值类型 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/** 键值对 */
export type KeyValue<K extends string | number | symbol = string, V = any> = Record<K, V>;

/** 可为空 */
export type Nullable<T> = T | null;

/** 可为 undefined */
export type Optional<T> = T | undefined;

/** 可为 null 或 undefined */
export type Maybe<T> = T | null | undefined;
