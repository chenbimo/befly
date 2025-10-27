/**
 * JWT 工具类 - Befly 项目专用
 * 直接集成环境变量，提供开箱即用的 JWT 功能
 */

import { createHmac } from 'crypto';
import { Env } from '../config/env.js';
import type { JwtPayload, JwtSignOptions, JwtVerifyOptions, JwtAlgorithm, JwtHeader, JwtDecoded } from '../types/jwt';

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
     * @param expiresIn - 过期时间（数字秒数或字符串如 "1h", "7d", "-1s"）
     * @returns 秒数（可以是负数）
     */
    static parseExpiration(expiresIn: string | number): number {
        if (typeof expiresIn === 'number') return expiresIn;
        if (typeof expiresIn !== 'string') throw new Error('过期时间格式无效');

        const numericValue = parseInt(expiresIn);
        if (!isNaN(numericValue) && numericValue.toString() === expiresIn) return numericValue;

        // 支持负数时间（用于测试过期token）
        const match = expiresIn.match(/^(-?\d+)(ms|[smhdwy])$/);
        if (!match) throw new Error('过期时间格式无效');

        const value = parseInt(match[1]); // 包含正负号
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
     * @param options - 签名选项（自动使用 Env.JWT_SECRET）
     * @returns JWT token字符串
     */
    static sign(payload: JwtPayload, options?: JwtSignOptions): string {
        if (!payload || typeof payload !== 'object') {
            throw new Error('载荷必须是非空对象');
        }

        const secret = options?.secret || Env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT密钥未配置');
        }

        const opts = options || {};
        const algorithm = (opts.algorithm || Env.JWT_ALGORITHM || 'HS256') as JwtAlgorithm;

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

        if (opts.expiresIn) {
            const expSeconds = Jwt.parseExpiration(opts.expiresIn);
            jwtPayload.exp = now + expSeconds;
        } else {
            // 使用默认过期时间
            const defaultExpiry = Env.JWT_EXPIRES_IN || '7d';
            const expSeconds = Jwt.parseExpiration(defaultExpiry);
            jwtPayload.exp = now + expSeconds;
        }
        if (opts.issuer) jwtPayload.iss = opts.issuer;
        if (opts.audience) jwtPayload.aud = opts.audience;
        if (opts.subject) jwtPayload.sub = opts.subject;
        if (opts.notBefore) {
            jwtPayload.nbf = typeof opts.notBefore === 'number' ? opts.notBefore : now + Jwt.parseExpiration(opts.notBefore);
        }
        if (opts.jwtId) jwtPayload.jti = opts.jwtId;

        const encodedPayload = Jwt.base64UrlEncode(JSON.stringify(jwtPayload));

        // 创建签名
        const data = `${header}.${encodedPayload}`;
        const signature = Jwt.createSignature(algorithm, secret, data);

        return `${data}.${signature}`;
    }

    /**
     * 验证 JWT token
     * @param token - JWT token字符串
     * @param options - 验证选项（自动使用 Env.JWT_SECRET）
     * @returns 解码后的载荷数据
     */
    static verify(token: string, options?: JwtVerifyOptions): JwtPayload {
        if (!token || typeof token !== 'string') {
            throw new Error('Token必须是非空字符串');
        }

        const secret = options?.secret || Env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT密钥未配置');
        }

        const opts = options || {};

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

            if (!opts.ignoreExpiration && payload.exp && payload.exp < now) {
                throw new Error('Token已过期 (expired)');
            }
            if (!opts.ignoreNotBefore && payload.nbf && payload.nbf > now) {
                throw new Error('Token尚未生效');
            }

            // 验证 issuer、audience、subject
            if (opts.issuer && payload.iss !== opts.issuer) {
                throw new Error('Token发行者无效');
            }
            if (opts.audience) {
                const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
                if (!audiences.includes(opts.audience)) {
                    throw new Error('Token受众无效');
                }
            }
            if (opts.subject && payload.sub !== opts.subject) {
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

    /**
     * 检查载荷是否包含特定角色
     * @param payload - JWT载荷
     * @param role - 要检查的角色
     * @returns 是否包含该角色
     */
    static hasRole(payload: JwtPayload, role: string): boolean {
        if (!payload) return false;
        if (payload.role === role) return true;
        if (Array.isArray(payload.roles) && payload.roles.includes(role)) return true;
        return false;
    }

    /**
     * 检查载荷是否包含任意一个角色
     * @param payload - JWT载荷
     * @param roles - 要检查的角色列表
     * @returns 是否包含任意一个角色
     */
    static hasAnyRole(payload: JwtPayload, roles: string[]): boolean {
        if (!payload) return false;
        return roles.some((role) => this.hasRole(payload, role));
    }

    /**
     * 检查载荷是否包含特定权限
     * @param payload - JWT载荷
     * @param permission - 要检查的权限
     * @returns 是否包含该权限
     */
    static hasPermission(payload: JwtPayload, permission: string): boolean {
        if (!payload || !payload.permissions) return false;
        return Array.isArray(payload.permissions) && payload.permissions.includes(permission);
    }

    /**
     * 检查载荷是否包含所有权限
     * @param payload - JWT载荷
     * @param permissions - 要检查的权限列表
     * @returns 是否包含所有权限
     */
    static hasAllPermissions(payload: JwtPayload, permissions: string[]): boolean {
        if (!payload || !payload.permissions) return false;
        return permissions.every((permission) => this.hasPermission(payload, permission));
    }

    // ==================== 便捷方法（自动使用环境变量） ====================

    /**
     * 创建用户 token（快捷方法）
     */
    static create(payload: JwtPayload): string {
        return this.sign(payload);
    }

    /**
     * 检查 token（快捷方法）
     */
    static check(token: string): JwtPayload {
        return this.verify(token);
    }

    /**
     * 解析 token（快捷方法，不验证签名）
     */
    static parse(token: string): JwtPayload {
        return this.decode(token);
    }

    /**
     * 签名用户认证 token
     */
    static signUserToken(userInfo: JwtPayload, options?: JwtSignOptions): string {
        return this.sign(userInfo, options);
    }

    /**
     * 签名 API 访问 token
     */
    static signAPIToken(payload: JwtPayload, options?: JwtSignOptions): string {
        return this.sign(payload, { audience: 'api', expiresIn: '1h', ...options });
    }

    /**
     * 签名刷新 token
     */
    static signRefreshToken(payload: JwtPayload, options?: JwtSignOptions): string {
        return this.sign(payload, { audience: 'refresh', expiresIn: '30d', ...options });
    }

    /**
     * 签名临时 token (用于重置密码等)
     */
    static signTempToken(payload: JwtPayload, options?: JwtSignOptions): string {
        return this.sign(payload, { audience: 'temporary', expiresIn: '15m', ...options });
    }

    /**
     * 验证用户认证 token
     */
    static verifyUserToken(token: string, options?: JwtVerifyOptions): JwtPayload {
        return this.verify(token, options);
    }

    /**
     * 验证 API 访问 token
     */
    static verifyAPIToken(token: string, options?: JwtVerifyOptions): JwtPayload {
        return this.verify(token, { audience: 'api', ...options });
    }

    /**
     * 验证刷新 token
     */
    static verifyRefreshToken(token: string, options?: JwtVerifyOptions): JwtPayload {
        return this.verify(token, { audience: 'refresh', ...options });
    }

    /**
     * 验证临时 token
     */
    static verifyTempToken(token: string, options?: JwtVerifyOptions): JwtPayload {
        return this.verify(token, { audience: 'temporary', ...options });
    }

    /**
     * 验证 token 并检查权限
     */
    static verifyWithPermissions(token: string, requiredPermissions: string | string[], options?: JwtVerifyOptions): JwtPayload {
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
    static verifyWithRoles(token: string, requiredRoles: string | string[], options?: JwtVerifyOptions): JwtPayload {
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
    static verifySoft(token: string, options?: JwtVerifyOptions): JwtPayload {
        return this.verify(token, { ignoreExpiration: true, ...options });
    }
}
