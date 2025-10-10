/**
 * JWT 工具类 - TypeScript 版本
 * 提供JWT token的签名、验证和解码功能以及应用层的便捷接口
 */

import { createHmac } from 'crypto';
import { Env } from '../config/env.js';

/**
 * JWT 算法类型
 */
export type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512';

/**
 * JWT Header 接口
 */
export interface JwtHeader {
    alg: JwtAlgorithm;
    typ: 'JWT';
}

/**
 * JWT Payload 基础接口
 */
export interface JwtPayload {
    /** 签发时间 */
    iat?: number;
    /** 过期时间 */
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
    /** 自定义字段 */
    [key: string]: any;
}

/**
 * JWT 签名选项
 */
export interface JwtSignOptions {
    /** JWT 密钥 */
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
    /** JWT 密钥 */
    secret?: string;
    /** 忽略过期时间 */
    ignoreExpiration?: boolean;
    /** 忽略生效时间 */
    ignoreNotBefore?: boolean;
    /** 验证签发者 */
    issuer?: string;
    /** 验证受众 */
    audience?: string;
    /** 验证主题 */
    subject?: string;
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
 * JWT 工具类
 */
export class Jwt {
    /** 算法映射 */
    private static readonly ALGORITHMS: Record<JwtAlgorithm, string> = {
        HS256: 'sha256',
        HS384: 'sha384',
        HS512: 'sha512'
    };

    /**
     * Base64 URL 编码
     */
    static base64UrlEncode(input: string | Buffer): string {
        const base64 = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input, 'utf8').toString('base64');
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    /**
     * Base64 URL 解码
     */
    static base64UrlDecode(str: string): string {
        let padding = 4 - (str.length % 4);
        if (padding !== 4) str += '='.repeat(padding);
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(str, 'base64').toString('utf8');
    }

    /**
     * 解析过期时间
     * @param expiresIn - 过期时间（数字秒数或字符串如 "1h", "7d"）
     * @returns 秒数
     */
    static parseExpiration(expiresIn: string | number): number {
        if (typeof expiresIn === 'number') return expiresIn;
        if (typeof expiresIn !== 'string') throw new Error('过期时间格式无效');

        const numericValue = parseInt(expiresIn);
        if (!isNaN(numericValue) && numericValue.toString() === expiresIn) return numericValue;

        const match = expiresIn.match(/^(\d+)(ms|[smhdwy])$/);
        if (!match) throw new Error('过期时间格式无效');

        const value = parseInt(match[1]);
        const unit = match[2];

        if (unit === 'ms') return Math.floor(value / 1000);

        const multipliers: Record<string, number> = {
            s: 1,
            m: 60,
            h: 3600,
            d: 86400,
            w: 604800,
            y: 31536000
        };

        return value * multipliers[unit];
    }

    /**
     * 创建签名
     */
    private static createSignature(algorithm: JwtAlgorithm, secret: string, data: string): string {
        const hashAlgorithm = this.ALGORITHMS[algorithm];
        if (!hashAlgorithm) throw new Error(`不支持的算法: ${algorithm}`);

        const hmac = createHmac(hashAlgorithm, secret);
        hmac.update(data);
        return this.base64UrlEncode(hmac.digest());
    }

    /**
     * 常量时间比较（防止时序攻击）
     */
    private static constantTimeCompare(a: string, b: string): boolean {
        if (a.length !== b.length) return false;
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }

    /**
     * 签名 JWT token
     * @param payload - JWT载荷数据
     * @param options - 签名选项
     * @returns JWT token字符串
     */
    static sign(payload: JwtPayload, options: JwtSignOptions = {}): string {
        if (!payload || typeof payload !== 'object') {
            throw new Error('载荷必须是非空对象');
        }

        const secret = options.secret || Env.JWT_SECRET;
        const algorithm = (options.algorithm || Env.JWT_ALGORITHM || 'HS256') as JwtAlgorithm;

        if (!secret) {
            throw new Error('JWT密钥是必需的');
        }

        const now = Math.floor(Date.now() / 1000);

        // 创建 header
        const header = Jwt.base64UrlEncode(
            JSON.stringify({
                alg: algorithm,
                typ: 'JWT'
            })
        );

        // 创建 payload
        const jwtPayload: JwtPayload = { ...payload, iat: now };

        if (options.expiresIn || Env.JWT_EXPIRES_IN) {
            const expSeconds = Jwt.parseExpiration(options.expiresIn || Env.JWT_EXPIRES_IN);
            jwtPayload.exp = now + expSeconds;
        }
        if (options.issuer) jwtPayload.iss = options.issuer;
        if (options.audience) jwtPayload.aud = options.audience;
        if (options.subject) jwtPayload.sub = options.subject;
        if (options.notBefore) {
            jwtPayload.nbf = typeof options.notBefore === 'number' ? options.notBefore : now + Jwt.parseExpiration(options.notBefore);
        }
        if (options.jwtId) jwtPayload.jti = options.jwtId;

        const encodedPayload = Jwt.base64UrlEncode(JSON.stringify(jwtPayload));

        // 创建签名
        const data = `${header}.${encodedPayload}`;
        const signature = Jwt.createSignature(algorithm, secret, data);

        return `${data}.${signature}`;
    }

    /**
     * 验证 JWT token
     * @param token - JWT token字符串
     * @param options - 验证选项
     * @returns 解码后的载荷数据
     */
    static verify(token: string, options: JwtVerifyOptions = {}): JwtPayload {
        if (!token || typeof token !== 'string') {
            throw new Error('Token必须是非空字符串');
        }

        const secret = options.secret || Env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT密钥是必需的');
        }

        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('JWT格式无效');
        }

        try {
            // 解析 header 和 payload
            const header = JSON.parse(Jwt.base64UrlDecode(parts[0])) as JwtHeader;
            const payload = JSON.parse(Jwt.base64UrlDecode(parts[1])) as JwtPayload;
            const signature = parts[2];

            // 验证算法
            if (!Jwt.ALGORITHMS[header.alg]) {
                throw new Error(`不支持的算法: ${header.alg}`);
            }

            // 验证签名
            const data = `${parts[0]}.${parts[1]}`;
            const expectedSignature = Jwt.createSignature(header.alg, secret, data);

            if (!Jwt.constantTimeCompare(signature, expectedSignature)) {
                throw new Error('Token签名无效');
            }

            // 验证时间
            const now = Math.floor(Date.now() / 1000);

            if (!options.ignoreExpiration && payload.exp && payload.exp < now) {
                throw new Error('Token已过期');
            }
            if (!options.ignoreNotBefore && payload.nbf && payload.nbf > now) {
                throw new Error('Token尚未生效');
            }

            // 验证 issuer、audience、subject
            if (options.issuer && payload.iss !== options.issuer) {
                throw new Error('Token发行者无效');
            }
            if (options.audience) {
                const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
                if (!audiences.includes(options.audience)) {
                    throw new Error('Token受众无效');
                }
            }
            if (options.subject && payload.sub !== options.subject) {
                throw new Error('Token主题无效');
            }

            return payload;
        } catch (error: any) {
            if (error.message.includes('JWT') || error.message.includes('Token') || error.message.includes('无效') || error.message.includes('过期') || error.message.includes('不支持')) {
                throw error;
            }
            throw new Error('Token验证失败: ' + error.message);
        }
    }

    /**
     * 解码 JWT token (不验证签名)
     * @param token - JWT token字符串
     * @param complete - 是否返回完整信息(包含header)
     * @returns 解码后的内容
     */
    static decode(token: string, complete?: false): JwtPayload;
    static decode(token: string, complete: true): JwtDecoded;
    static decode(token: string, complete: boolean = false): JwtPayload | JwtDecoded {
        if (!token || typeof token !== 'string') {
            throw new Error('Token必须是非空字符串');
        }

        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('JWT格式无效');
        }

        try {
            const header = JSON.parse(Jwt.base64UrlDecode(parts[0])) as JwtHeader;
            const payload = JSON.parse(Jwt.base64UrlDecode(parts[1])) as JwtPayload;

            return complete ? { header, payload, signature: parts[2] } : payload;
        } catch (error: any) {
            throw new Error('JWT解码失败: ' + error.message);
        }
    }

    /**
     * 获取 token 剩余有效时间
     * @param token - JWT token字符串
     * @returns 剩余秒数，-1表示已过期或无过期时间
     */
    static getTimeToExpiry(token: string): number {
        try {
            const payload = this.decode(token);
            if (!payload.exp) return -1;
            const remaining = payload.exp - Math.floor(Date.now() / 1000);
            return remaining > 0 ? remaining : -1;
        } catch {
            return -1;
        }
    }

    /**
     * 检查 token 是否已过期
     * @param token - JWT token字符串
     * @returns 是否已过期
     */
    static isExpired(token: string): boolean {
        return this.getTimeToExpiry(token) <= 0;
    }

    // ==================== 应用层便捷方法 ====================

    /**
     * 签名用户认证 token
     */
    static signUserToken(userInfo: JwtPayload, options: JwtSignOptions = {}): string {
        return this.sign(userInfo, options);
    }

    /**
     * 签名 API 访问 token
     */
    static signAPIToken(payload: JwtPayload, options: JwtSignOptions = {}): string {
        return this.sign(payload, { audience: 'api', expiresIn: '1h', ...options });
    }

    /**
     * 签名刷新 token
     */
    static signRefreshToken(payload: JwtPayload, options: JwtSignOptions = {}): string {
        return this.sign(payload, { audience: 'refresh', expiresIn: '30d', ...options });
    }

    /**
     * 签名临时 token (用于重置密码等)
     */
    static signTempToken(payload: JwtPayload, options: JwtSignOptions = {}): string {
        return this.sign(payload, { audience: 'temporary', expiresIn: '15m', ...options });
    }

    /**
     * 验证用户认证 token
     */
    static verifyUserToken(token: string, options: JwtVerifyOptions = {}): JwtPayload {
        return this.verify(token, options);
    }

    /**
     * 验证 API 访问 token
     */
    static verifyAPIToken(token: string, options: JwtVerifyOptions = {}): JwtPayload {
        return this.verify(token, { audience: 'api', ...options });
    }

    /**
     * 验证刷新 token
     */
    static verifyRefreshToken(token: string, options: JwtVerifyOptions = {}): JwtPayload {
        return this.verify(token, { audience: 'refresh', ...options });
    }

    /**
     * 验证临时 token
     */
    static verifyTempToken(token: string, options: JwtVerifyOptions = {}): JwtPayload {
        return this.verify(token, { audience: 'temporary', ...options });
    }

    /**
     * 验证 token 并检查权限
     */
    static verifyWithPermissions(token: string, requiredPermissions: string | string[], options: JwtVerifyOptions = {}): JwtPayload {
        const payload = this.verify(token, options);

        if (!payload.permissions) {
            throw new Error('Token中不包含权限信息');
        }

        const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
        const hasPermission = permissions.every((permission) => payload.permissions.includes(permission));

        if (!hasPermission) {
            throw new Error('权限不足');
        }

        return payload;
    }

    /**
     * 验证 token 并检查角色
     */
    static verifyWithRoles(token: string, requiredRoles: string | string[], options: JwtVerifyOptions = {}): JwtPayload {
        const payload = this.verify(token, options);

        if (!payload.role && !payload.roles) {
            throw new Error('Token中不包含角色信息');
        }

        const userRoles = payload.roles || [payload.role];
        const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

        const hasRole = roles.some((role) => userRoles.includes(role));

        if (!hasRole) {
            throw new Error('角色权限不足');
        }

        return payload;
    }

    /**
     * 软验证 token (忽略过期时间)
     */
    static verifySoft(token: string, options: JwtVerifyOptions = {}): JwtPayload {
        return this.verify(token, { ignoreExpiration: true, ...options });
    }

    /**
     * 检查 token 是否即将过期
     * @param token - JWT token字符串
     * @param thresholdSeconds - 过期阈值(秒)，默认300秒(5分钟)
     * @returns 是否即将过期
     */
    static isNearExpiry(token: string, thresholdSeconds: number = 300): boolean {
        const timeToExpiry = this.getTimeToExpiry(token);
        return timeToExpiry > 0 && timeToExpiry <= thresholdSeconds;
    }
}
