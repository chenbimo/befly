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
    /**
     * 注意：JWT payload 的业务字段来自 `befly.jwt.sign(payload)` 的入参。
     * 也就是说：你在 sign 时放了什么字段，verify/decode 时就能取到什么字段。
     *
     * 另外，JWT 标准 claim（如 iat/exp/nbf/iss/aud/sub/jti）可能由 signer 注入。
     */

    /** 用户 ID（历史字段：部分代码用 userId） */
    userId?: string | number;

    /** 用户 ID（推荐字段：部分项目使用 id） */
    id?: string | number;

    /** 角色编码 */
    roleCode?: string;

    /** 昵称 */
    nickname?: string;

    /** 角色类型 */
    roleType?: string;

    /** 签发时间（秒级或毫秒级取决于实现，当前由底层库决定） */
    iat?: number;

    /** 过期时间（秒级或毫秒级取决于实现，当前由底层库决定） */
    exp?: number;

    /** 生效时间 */
    nbf?: number;

    /** 签发者 */
    iss?: string;

    /** 受众 */
    aud?: string | string[];

    /** 主题 */
    sub?: string;

    /** JWT ID */
    jti?: string;

    /** 其他自定义字段（由 sign 入参决定） */
    [key: string]: unknown;
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
