import { createHmac } from 'crypto';

/**
 * JWT基础工具类
 * 提供JWT相关的基础工具方法
 */
export class Jwt {
    // 支持的算法映射
    static ALGORITHMS = {
        HS256: 'sha256',
        HS384: 'sha384',
        HS512: 'sha512'
    };

    /**
     * Base64 URL 编码
     * @param {string|Buffer} input - 需要编码的输入
     * @returns {string} Base64 URL编码结果
     */
    static base64UrlEncode(input) {
        const base64 = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input, 'utf8').toString('base64');
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    /**
     * Base64 URL 解码
     * @param {string} str - Base64 URL编码的字符串
     * @returns {string} 解码后的字符串
     */
    static base64UrlDecode(str) {
        const padding = 4 - (str.length % 4);
        if (padding !== 4) str += '='.repeat(padding);
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(str, 'base64').toString('utf8');
    }

    /**
     * 解析过期时间为秒数
     * @param {string|number} expiresIn - 过期时间表达式
     * @returns {number} 过期时间（秒数）
     */
    static parseExpiration(expiresIn) {
        if (typeof expiresIn === 'number') return expiresIn;
        if (typeof expiresIn !== 'string') throw new Error('过期时间格式无效');

        // 如果是纯数字字符串，直接转换为数字
        const numericValue = parseInt(expiresIn);
        if (!isNaN(numericValue) && numericValue.toString() === expiresIn) {
            return numericValue;
        }

        // 支持毫秒(ms)和其他时间单位
        const match = expiresIn.match(/^(\d+)(ms|[smhdwy])$/);
        if (!match) throw new Error('过期时间格式无效');

        const value = parseInt(match[1]);
        const unit = match[2];

        if (unit === 'ms') {
            return Math.floor(value / 1000); // 毫秒转秒，向下取整
        }

        const multipliers = { s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31536000 };
        return value * multipliers[unit];
    }

    /**
     * 创建HMAC签名
     * @param {string} algorithm - 算法名称
     * @param {string} secret - 密钥
     * @param {string} data - 待签名数据
     * @returns {string} Base64 URL编码的签名
     */
    static createSignature(algorithm, secret, data) {
        const hashAlgorithm = this.ALGORITHMS[algorithm];
        if (!hashAlgorithm) throw new Error(`不支持的算法: ${algorithm}`);

        const hmac = createHmac(hashAlgorithm, secret);
        hmac.update(data);
        return this.base64UrlEncode(hmac.digest());
    }

    /**
     * 常量时间字符串比较（防止时序攻击）
     * @param {string} a - 字符串A
     * @param {string} b - 字符串B
     * @returns {boolean} 是否相等
     */
    static constantTimeCompare(a, b) {
        if (a.length !== b.length) return false;
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }
}
