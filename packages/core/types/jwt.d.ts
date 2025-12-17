/**
 * JWT 相关类型定义
 */

/**
 * JWT 算法类型
 */
export type JwtAlgorithm = "HS256" | "HS384" | "HS512";

/**
 * JWT Header 接口
 */
export interface JwtHeader {
    alg: JwtAlgorithm;
    typ: "JWT";
}

/**
 * JWT 载荷
 */
export interface JwtPayload {
    /** 用户 ID */
    userId?: string | number;
    /** 用户 ID（部分项目使用 id 字段） */
    id?: string | number;
    /** 角色编码 */
    roleCode?: string;
    /** 昵称 */
    nickname?: string;
    /** 角色类型 */
    roleType?: string;
    /** 用户名 */
    username?: string;
    /** 角色 */
    role?: string;
    /** 角色列表 */
    roles?: string[];
    /** 权限列表 */
    permissions?: string[];
    /** 签发时间 */
    iat?: number;
    /** 过期时间 */
    exp?: number;
    /** 主题 */
    sub?: string;
    /** 签发者 */
    iss?: string;
    /** 受众 */
    aud?: string | string[];
    /** JWT ID */
    jti?: string;
    /** 生效时间 */
    nbf?: number;
    /** 其他自定义字段 */
    [key: string]: any;
}

/**
 * JWT 完整解码结果
 */
export interface JwtDecoded {
    header: JwtHeader;
    payload: JwtPayload;
    signature: string;
}

/**
 * JWT 签名选项
 */
export interface JwtSignOptions {
    /** 密钥 */
    secret?: string;
    /** 算法 */
    algorithm?: JwtAlgorithm;
    /** 过期时间 */
    expiresIn?: string | number;
    /** 签发者 */
    issuer?: string;
    /** 受众 */
    audience?: string;
    /** 主题 */
    subject?: string;
    /** 生效时间 */
    notBefore?: string | number;
    /** JWT ID */
    jwtId?: string;
}

/**
 * JWT 验证选项
 */
export interface JwtVerifyOptions {
    /** 密钥 */
    secret?: string;
    /** 算法列表 */
    algorithms?: JwtAlgorithm[];
    /** 签发者 */
    issuer?: string;
    /** 受众 */
    audience?: string;
    /** 主题 */
    subject?: string;
    /** 是否忽略过期 */
    ignoreExpiration?: boolean;
    /** 是否忽略生效时间 */
    ignoreNotBefore?: boolean;
}
