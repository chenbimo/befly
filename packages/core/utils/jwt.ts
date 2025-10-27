/**
 * JWT 工具类 - 框架适配版本
 * 从 lib/jwt 导入并提供 Env 集成的便捷方法
 */

import { Env } from '../config/env.js';
import { Jwt as LibJwt } from '../lib/jwt.js';
import type { JwtPayload, JwtSignOptions, JwtVerifyOptions } from '../types/jwt';

/**
 * JWT 工具类（带 Env 集成）
 */
export class Jwt extends LibJwt {
    /**
     * 创建 token（使用默认配置）
     * @param payload - 载荷数据
     * @returns JWT token字符串
     */
    static create(payload: JwtPayload): string {
        const expiresIn = Env.JWT_EXPIRES_IN || '7d';
        const algorithm = (Env.JWT_ALGORITHM || 'HS256') as any;
        return super.sign(payload, Env.JWT_SECRET, {
            expiresIn,
            algorithm
        });
    }

    /**
     * 验证 token（使用默认配置）
     * @param token - JWT token字符串
     * @returns 解码后的载荷数据
     */
    static check(token: string): JwtPayload {
        return this.verify(token, Env.JWT_SECRET);
    }

    /**
     * 解析 token（不验证签名，使用 decode）
     * @param token - JWT token字符串
     * @returns 解码后的载荷数据
     */
    static parse(token: string): JwtPayload {
        return this.decode(token);
    }

    /**
     * 签名 JWT token（支持兼容旧版 API）
     */
    static sign(payload: JwtPayload, secretOrOptions?: string | JwtSignOptions, expiresIn?: string | number): string {
        // 兼容旧版：sign(payload, secret, expiresIn)
        if (typeof secretOrOptions === 'string') {
            return super.sign(payload, secretOrOptions, { expiresIn });
        }

        // 新版：sign(payload, options)
        const options = secretOrOptions || {};
        const secret = options.secret || Env.JWT_SECRET;
        const { secret: _, ...restOptions } = options;

        return super.sign(payload, secret, restOptions);
    }

    /**
     * 验证 JWT token（支持兼容旧版 API）
     */
    static verify(token: string, secretOrOptions?: string | JwtVerifyOptions): JwtPayload {
        // 兼容旧版：verify(token, secret)
        if (typeof secretOrOptions === 'string') {
            return super.verify(token, secretOrOptions);
        }

        // 新版：verify(token, options)
        const options = secretOrOptions || {};
        const secret = options.secret || Env.JWT_SECRET;
        const { secret: _, ...restOptions } = options;

        return super.verify(token, secret, restOptions);
    }

    /**
     * 签名用户认证 token（使用 Env 配置）
     */
    static signUserToken(userInfo: JwtPayload, options: Omit<JwtSignOptions, 'secret'> = {}): string {
        return super.signUserToken(userInfo, Env.JWT_SECRET, options);
    }

    /**
     * 签名 API 访问 token（使用 Env 配置）
     */
    static signAPIToken(payload: JwtPayload, options: Omit<JwtSignOptions, 'secret'> = {}): string {
        return super.signAPIToken(payload, Env.JWT_SECRET, options);
    }

    /**
     * 签名刷新 token（使用 Env 配置）
     */
    static signRefreshToken(payload: JwtPayload, options: Omit<JwtSignOptions, 'secret'> = {}): string {
        return super.signRefreshToken(payload, Env.JWT_SECRET, options);
    }

    /**
     * 签名临时 token（使用 Env 配置）
     */
    static signTempToken(payload: JwtPayload, options: Omit<JwtSignOptions, 'secret'> = {}): string {
        return super.signTempToken(payload, Env.JWT_SECRET, options);
    }

    /**
     * 验证用户认证 token（使用 Env 配置）
     */
    static verifyUserToken(token: string, options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifyUserToken(token, Env.JWT_SECRET, options);
    }

    /**
     * 验证 API 访问 token（使用 Env 配置）
     */
    static verifyAPIToken(token: string, options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifyAPIToken(token, Env.JWT_SECRET, options);
    }

    /**
     * 验证刷新 token（使用 Env 配置）
     */
    static verifyRefreshToken(token: string, options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifyRefreshToken(token, Env.JWT_SECRET, options);
    }

    /**
     * 验证临时 token（使用 Env 配置）
     */
    static verifyTempToken(token: string, options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifyTempToken(token, Env.JWT_SECRET, options);
    }

    /**
     * 验证 token 并检查权限（使用 Env 配置）
     */
    static verifyWithPermissions(token: string, requiredPermissions: string | string[], options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifyWithPermissions(token, Env.JWT_SECRET, requiredPermissions, options);
    }

    /**
     * 验证 token 并检查角色（使用 Env 配置）
     */
    static verifyWithRoles(token: string, requiredRoles: string | string[], options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifyWithRoles(token, Env.JWT_SECRET, requiredRoles, options);
    }

    /**
     * 软验证 token（使用 Env 配置）
     */
    static verifySoft(token: string, options: Omit<JwtVerifyOptions, 'secret'> = {}): JwtPayload {
        return super.verifySoft(token, Env.JWT_SECRET, options);
    }
}
