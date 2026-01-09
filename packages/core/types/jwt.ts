/**
 * JWT 相关类型定义
 */

import type { JsonValue } from "./common";

/**
 * JWT Payload 类型
 */
export interface JwtPayload {
    /** 用户 ID */
    id: number;
    /** 角色代码 */
    roleCode: string;
    /** 角色类型 */
    roleType: string;
    /** 用户昵称 */
    nickname: string;
    /** 过期时间戳 */
    exp?: number;
    /** 签发时间 */
    iat?: number;
    /** 其他字段 */
    [key: string]: JsonValue | undefined;
}

/**
 * JWT header（最常用字段）
 */
export interface JwtHeader {
    alg?: string;
    typ?: string;
    kid?: string;
    [key: string]: JsonValue | undefined;
}

/**
 * sign() 选项（映射 fast-jwt 的 signer 参数）
 */
export interface JwtSignOptions {
    secret?: string;
    expiresIn?: string | number;
    algorithm?: string;
    issuer?: string;
    audience?: string | string[];
    subject?: string;
    jwtId?: string;
    notBefore?: number | string;
}

/**
 * verify() 选项（映射 fast-jwt 的 verifier 参数）
 */
export interface JwtVerifyOptions {
    secret?: string;
    algorithms?: string[];
    issuer?: string | string[];
    audience?: string | string[];
    subject?: string | string[];
    ignoreExpiration?: boolean;
    ignoreNotBefore?: boolean;
}

/**
 * decode(complete=true) 返回
 */
export interface JwtDecoded {
    header: JwtHeader;
    payload: JwtPayload;
    signature: string;
}

/**
 * Jwt 实例接口（类型层）。
 *
 * runtime 实现位于 core 内部，但对外类型应从 `befly/types/*` 获取。
 */
export interface Jwt {
    sign(payload: JwtPayload, options?: JwtSignOptions): string;
    verify<T = JwtPayload>(token: string, options?: JwtVerifyOptions): T;

    decode(token: string, complete?: false): JwtPayload;
    decode(token: string, complete: true): JwtDecoded;
}
