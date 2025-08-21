import { Jwt as JwtBase } from '../libs/jwt.js';
import { Env } from '../config/env.js';

/**
 * JWT 工具类
 * 提供JWT token的签名、验证和解码功能以及应用层的便捷接口
 */
export class Jwt {
    /**
     * 签名JWT token
     * @param {object} payload - JWT载荷数据
     * @param {object} options - 签名选项
     * @returns {string} JWT token字符串
     */
    static sign(payload, options = {}) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('载荷必须是非空对象');
        }

        const secret = options.secret || Env.JWT_SECRET;
        const algorithm = options.algorithm || Env.JWT_ALGORITHM || 'HS256';

        if (!secret) {
            throw new Error('JWT密钥是必需的');
        }
        const now = Math.floor(Date.now() / 1000);

        // 创建header
        const header = JwtBase.base64UrlEncode(
            JSON.stringify({
                alg: algorithm,
                typ: 'JWT'
            })
        );

        // 创建payload
        const jwtPayload = { ...payload, iat: now };

        if (options.expiresIn || Env.JWT_EXPIRES_IN) {
            const expSeconds = JwtBase.parseExpiration(options.expiresIn || Env.JWT_EXPIRES_IN);
            jwtPayload.exp = now + expSeconds;
        }
        if (options.issuer) jwtPayload.iss = options.issuer;
        if (options.audience) jwtPayload.aud = options.audience;
        if (options.subject) jwtPayload.sub = options.subject;
        if (options.notBefore) {
            jwtPayload.nbf = typeof options.notBefore === 'number' ? options.notBefore : now + JwtBase.parseExpiration(options.notBefore);
        }
        if (options.jwtId) jwtPayload.jti = options.jwtId;

        const encodedPayload = JwtBase.base64UrlEncode(JSON.stringify(jwtPayload));

        // 创建签名
        const data = `${header}.${encodedPayload}`;
        const signature = JwtBase.createSignature(algorithm, secret, data);

        return `${data}.${signature}`;
    }

    /**
     * 验证JWT token
     * @param {string} token - JWT token字符串
     * @param {object} options - 验证选项
     * @returns {object} 解码后的载荷数据
     */
    static verify(token, options = {}) {
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
            // 解析header和payload
            const header = JSON.parse(JwtBase.base64UrlDecode(parts[0]));
            const payload = JSON.parse(JwtBase.base64UrlDecode(parts[1]));
            const signature = parts[2];

            // 验证算法
            if (!JwtBase.ALGORITHMS[header.alg]) {
                throw new Error(`不支持的算法: ${header.alg}`);
            }

            // 验证签名
            const data = `${parts[0]}.${parts[1]}`;
            const expectedSignature = JwtBase.createSignature(header.alg, secret, data);

            if (!JwtBase.constantTimeCompare(signature, expectedSignature)) {
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

            // 验证issuer、audience、subject
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
        } catch (error) {
            if (error.message.includes('JWT') || error.message.includes('Token') || error.message.includes('无效') || error.message.includes('过期') || error.message.includes('不支持')) {
                throw error;
            }
            throw new Error('Token验证失败: ' + error.message);
        }
    }

    /**
     * 解码JWT token (不验证签名)
     * @param {string} token - JWT token字符串
     * @param {boolean} complete - 是否返回完整信息(包含header)
     * @returns {object} 解码后的内容
     */
    static decode(token, complete = false) {
        if (!token || typeof token !== 'string') {
            throw new Error('Token必须是非空字符串');
        }

        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('JWT格式无效');
        }

        try {
            const header = JSON.parse(JwtBase.base64UrlDecode(parts[0]));
            const payload = JSON.parse(JwtBase.base64UrlDecode(parts[1]));

            return complete ? { header, payload, signature: parts[2] } : payload;
        } catch (error) {
            throw new Error('JWT解码失败: ' + error.message);
        }
    }

    /**
     * 获取token剩余有效时间
     * @param {string} token - JWT token字符串
     * @returns {number} 剩余秒数，-1表示已过期或无过期时间
     */
    static getTimeToExpiry(token) {
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
     * 检查token是否已过期
     * @param {string} token - JWT token字符串
     * @returns {boolean} 是否已过期
     */
    static isExpired(token) {
        return this.getTimeToExpiry(token) <= 0;
    }

    // 以下是应用层的便捷方法

    /**
     * 签名用户认证token
     * @param {object} userInfo - 用户信息对象
     * @param {object} options - 签名选项
     * @returns {string} JWT token字符串
     */
    static signUserToken(userInfo, options = {}) {
        return this.sign(userInfo, options);
    }

    /**
     * 签名API访问token
     * @param {object} payload - 载荷数据
     * @param {object} options - 签名选项
     * @returns {string} API token字符串
     */
    static signAPIToken(payload, options = {}) {
        return this.sign(payload, { audience: 'api', expiresIn: '1h', ...options });
    }

    /**
     * 签名刷新token
     * @param {object} payload - 载荷数据
     * @param {object} options - 签名选项
     * @returns {string} 刷新token字符串
     */
    static signRefreshToken(payload, options = {}) {
        return this.sign(payload, { audience: 'refresh', expiresIn: '30d', ...options });
    }

    /**
     * 签名临时token (用于重置密码等)
     * @param {object} payload - 载荷数据
     * @param {object} options - 签名选项
     * @returns {string} 临时token字符串
     */
    static signTempToken(payload, options = {}) {
        return this.sign(payload, { audience: 'temporary', expiresIn: '15m', ...options });
    }

    /**
     * 验证用户认证token
     * @param {string} token - JWT token字符串
     * @param {object} options - 验证选项
     * @returns {object} 用户信息对象
     */
    static verifyUserToken(token, options = {}) {
        return this.verify(token, options);
    }

    /**
     * 验证API访问token
     * @param {string} token - API token字符串
     * @param {object} options - 验证选项
     * @returns {object} 解码后的载荷数据
     */
    static verifyAPIToken(token, options = {}) {
        return this.verify(token, { audience: 'api', ...options });
    }

    /**
     * 验证刷新token
     * @param {string} token - 刷新token字符串
     * @param {object} options - 验证选项
     * @returns {object} 解码后的载荷数据
     */
    static verifyRefreshToken(token, options = {}) {
        return this.verify(token, { audience: 'refresh', ...options });
    }

    /**
     * 验证临时token
     * @param {string} token - 临时token字符串
     * @param {object} options - 验证选项
     * @returns {object} 解码后的载荷数据
     */
    static verifyTempToken(token, options = {}) {
        return this.verify(token, { audience: 'temporary', ...options });
    }

    /**
     * 验证token并检查权限
     * @param {string} token - JWT token字符串
     * @param {string|Array<string>} requiredPermissions - 需要的权限列表
     * @param {object} options - 验证选项
     * @returns {object} 解码后的载荷数据
     */
    static verifyWithPermissions(token, requiredPermissions, options = {}) {
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
     * 验证token并检查角色
     * @param {string} token - JWT token字符串
     * @param {string|Array<string>} requiredRoles - 需要的角色列表
     * @param {object} options - 验证选项
     * @returns {object} 解码后的载荷数据
     */
    static verifyWithRoles(token, requiredRoles, options = {}) {
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
     * 软验证token (忽略过期时间)
     * @param {string} token - JWT token字符串
     * @param {object} options - 验证选项
     * @returns {object} 解码后的载荷数据
     */
    static verifySoft(token, options = {}) {
        return this.verify(token, { ignoreExpiration: true, ...options });
    }

    /**
     * 检查token是否即将过期
     * @param {string} token - JWT token字符串
     * @param {number} thresholdSeconds - 过期阈值(秒)，默认300秒(5分钟)
     * @returns {boolean} 是否即将过期
     */
    static isNearExpiry(token, thresholdSeconds = 300) {
        const timeToExpiry = this.getTimeToExpiry(token);
        return timeToExpiry > 0 && timeToExpiry <= thresholdSeconds;
    }
}
