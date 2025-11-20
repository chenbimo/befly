/**
 * JWT 工具类 - Befly 项目专用
 * 直接集成环境变量，提供开箱即用的 JWT 功能
 */

import { createHmac } from 'crypto';
import type { JwtPayload, JwtSignOptions, JwtVerifyOptions, JwtAlgorithm, JwtHeader, JwtDecoded } from '../types/jwt';
import type { AuthConfig } from '../types/befly';

/**
 * JWT 工具类
 */
export class Jwt {
    /** 默认配置 */
    private static config: AuthConfig = {
        secret: 'befly-secret',
        expiresIn: '7d',
        algorithm: 'HS256'
    };

    /**
     * 配置 JWT
     * @param config - JWT 配置
     */
    static configure(config: AuthConfig) {
        this.config = { ...this.config, ...config };
    }

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
     * 签名生成 Token
     * @param payload - 数据载荷
     * @param options - 签名选项
     * @returns Token 字符串
     */
    static async sign(payload: JwtPayload, options: JwtSignOptions = {}): Promise<string> {
        const secret = options.secret || this.config.secret || 'befly-secret';
        const expiresIn = options.expiresIn || this.config.expiresIn || '7d';
        const algorithm = (options.algorithm || this.config.algorithm || 'HS256') as JwtAlgorithm;

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

        if (expiresIn) {
            const expSeconds = Jwt.parseExpiration(expiresIn);
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
     * 验证 Token
     * @param token - Token 字符串
     * @param options - 验证选项
     * @returns 解码后的载荷
     */
    static async verify<T = JwtPayload>(token: string, options: JwtVerifyOptions = {}): Promise<T> {
        if (!token || typeof token !== 'string') {
            throw new Error('Token必须是非空字符串');
        }

        const secret = options.secret || this.config.secret || 'befly-secret';
        const algorithm = (options.algorithm || this.config.algorithm || 'HS256') as JwtAlgorithm;

        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Token 格式无效');
        }

        const [headerB64, payloadB64, signature] = parts;

        // 验证签名
        const data = `${headerB64}.${payloadB64}`;
        const expectedSignature = Jwt.createSignature(algorithm, secret, data);

        if (!Jwt.constantTimeCompare(signature, expectedSignature)) {
            throw new Error('Token 签名无效');
        }

        // 解码 payload
        const payloadStr = Jwt.base64UrlDecode(payloadB64);
        let payload: JwtPayload;
        try {
            payload = JSON.parse(payloadStr);
        } catch (e) {
            throw new Error('Token 载荷无效');
        }

        // 验证过期时间
        if (!options.ignoreExpiration) {
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < now) {
                throw new Error('Token 已过期');
            }
        }

        // 验证其他声明
        if (options.issuer && payload.iss !== options.issuer) {
            throw new Error('Token issuer 无效');
        }
        if (options.audience && payload.aud !== options.audience) {
            throw new Error('Token audience 无效');
        }
        if (options.subject && payload.sub !== options.subject) {
            throw new Error('Token subject 无效');
        }
        if (options.jwtId && payload.jti !== options.jwtId) {
            throw new Error('Token jwtId 无效');
        }

        return payload as T;
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
    static async create(payload: JwtPayload): Promise<string> {
        return this.sign(payload);
    }

    /**
     * 检查 token（快捷方法）
     */
    static async check(token: string): Promise<JwtPayload> {
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
    static async signUserToken(userInfo: JwtPayload, options?: JwtSignOptions): Promise<string> {
        return this.sign(userInfo, options);
    }

    /**
     * 签名 API 访问 token
     */
    static async signAPIToken(payload: JwtPayload, options?: JwtSignOptions): Promise<string> {
        return this.sign(payload, { audience: 'api', expiresIn: '1h', ...options });
    }

    /**
     * 签名刷新 token
     */
    static async signRefreshToken(payload: JwtPayload, options?: JwtSignOptions): Promise<string> {
        return this.sign(payload, { audience: 'refresh', expiresIn: '30d', ...options });
    }

    /**
     * 签名临时 token (用于重置密码等)
     */
    static async signTempToken(payload: JwtPayload, options?: JwtSignOptions): Promise<string> {
        return this.sign(payload, { audience: 'temporary', expiresIn: '15m', ...options });
    }

    /**
     * 验证用户认证 token
     */
    static async verifyUserToken(token: string, options?: JwtVerifyOptions): Promise<JwtPayload> {
        return this.verify(token, options);
    }

    /**
     * 验证 API 访问 token
     */
    static async verifyAPIToken(token: string, options?: JwtVerifyOptions): Promise<JwtPayload> {
        return this.verify(token, { audience: 'api', ...options });
    }

    /**
     * 验证刷新 token
     */
    static async verifyRefreshToken(token: string, options?: JwtVerifyOptions): Promise<JwtPayload> {
        return this.verify(token, { audience: 'refresh', ...options });
    }

    /**
     * 验证临时 token
     */
    static async verifyTempToken(token: string, options?: JwtVerifyOptions): Promise<JwtPayload> {
        return this.verify(token, { audience: 'temporary', ...options });
    }

    /**
     * 验证 token 并检查权限
     */
    static async verifyWithPermissions(token: string, requiredPermissions: string | string[], options?: JwtVerifyOptions): Promise<JwtPayload> {
        const payload = await this.verify(token, options);

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
    static async verifyWithRoles(token: string, requiredRoles: string | string[], options?: JwtVerifyOptions): Promise<JwtPayload> {
        const payload = await this.verify(token, options);

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
    static async verifySoft(token: string, options?: JwtVerifyOptions): Promise<JwtPayload> {
        return this.verify(token, { ignoreExpiration: true, ...options });
    }
}
