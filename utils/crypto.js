import { createSign } from 'node:crypto';

export class Crypto2 {
    /**
     * MD5 哈希
     * @param {string|Uint8Array} data - 要哈希的数据
     * @param {string} encoding - 输出编码 ('hex', 'base64')
     * @returns {string} MD5 哈希值
     */
    static md5(data, encoding = 'hex') {
        const hasher = new Bun.CryptoHasher('md5');
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * HMAC-MD5 签名
     * @param {string|Uint8Array} key - 密钥
     * @param {string|Uint8Array} data - 要签名的数据
     * @param {string} encoding - 输出编码 ('hex', 'base64')
     * @returns {string} HMAC-MD5 签名
     */
    static hmacMd5(key, data, encoding = 'hex') {
        const hasher = new Bun.CryptoHasher('md5', key);
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * SHA-1 哈希
     * @param {string|Uint8Array} data - 要哈希的数据
     * @param {string} encoding - 输出编码 ('hex', 'base64')
     * @returns {string} SHA-1 哈希值
     */
    static sha1(data, encoding = 'hex') {
        const hasher = new Bun.CryptoHasher('sha1');
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * HMAC-SHA1 签名
     * @param {string|Uint8Array} key - 密钥
     * @param {string|Uint8Array} data - 要签名的数据
     * @param {string} encoding - 输出编码 ('hex', 'base64')
     * @returns {string} HMAC-SHA1 签名
     */
    static hmacSha1(key, data, encoding = 'hex') {
        const hasher = new Bun.CryptoHasher('sha1', key);
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * SHA-256 哈希
     * @param {string|Uint8Array} data - 要哈希的数据
     * @param {string} encoding - 输出编码 ('hex', 'base64')
     * @returns {string} SHA-256 哈希值
     */
    static sha256(data, encoding = 'hex') {
        const hasher = new Bun.CryptoHasher('sha256');
        hasher.update(data);
        return hasher.digest(encoding);
    }

    static rsaSha256(data, privateKey, encoding = 'hex') {
        const sign = createSign('RSA-SHA256');
        sign.update(data);
        const signature = sign.sign(privateKey, encoding);
        return signature;
    }

    /**
     * HMAC-SHA256 签名
     * @param {string|Uint8Array} key - 密钥
     * @param {string|Uint8Array} data - 要签名的数据
     * @param {string} encoding - 输出编码 ('hex', 'base64')
     * @returns {string} HMAC-SHA256 签名
     */
    static hmacSha256(key, data, encoding = 'hex') {
        const hasher = new Bun.CryptoHasher('sha256', key);
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * SHA-512 哈希
     * @param {string|Uint8Array} data - 要哈希的数据
     * @param {string} encoding - 输出编码 ('hex', 'base64')
     * @returns {string} SHA-512 哈希值
     */
    static sha512(data, encoding = 'hex') {
        const hasher = new Bun.CryptoHasher('sha512');
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * HMAC-SHA512 签名
     * @param {string|Uint8Array} key - 密钥
     * @param {string|Uint8Array} data - 要签名的数据
     * @param {string} encoding - 输出编码 ('hex', 'base64')
     * @returns {string} HMAC-SHA512 签名
     */
    static hmacSha512(key, data, encoding = 'hex') {
        const hasher = new Bun.CryptoHasher('sha512', key);
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * 通用哈希方法
     * @param {string} algorithm - 算法名称 ('md5', 'sha1', 'sha256', 'sha512')
     * @param {string|Uint8Array} data - 要哈希的数据
     * @param {string} encoding - 输出编码 ('hex', 'base64')
     * @returns {string} 哈希值
     */
    static hash(algorithm, data, encoding = 'hex') {
        const hasher = new Bun.CryptoHasher(algorithm);
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * 通用 HMAC 方法
     * @param {string} algorithm - 算法名称 ('md5', 'sha1', 'sha256', 'sha512')
     * @param {string|Uint8Array} key - 密钥
     * @param {string|Uint8Array} data - 要签名的数据
     * @param {string} encoding - 输出编码 ('hex', 'base64')
     * @returns {string} HMAC 签名
     */
    static hmac(algorithm, key, data, encoding = 'hex') {
        const hasher = new Bun.CryptoHasher(algorithm, key);
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * 文件哈希
     * @param {string} filePath - 文件路径
     * @param {string} algorithm - 算法名称 (默认 'sha256')
     * @param {string} encoding - 输出编码 ('hex', 'base64')
     * @returns {Promise<string>} 文件哈希值
     */
    static async hashFile(filePath, algorithm = 'sha256', encoding = 'hex') {
        const file = Bun.file(filePath);
        const hasher = new Bun.CryptoHasher(algorithm);

        const stream = file.stream();
        const reader = stream.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                hasher.update(value);
            }
            return hasher.digest(encoding);
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * 创建流式哈希器
     * @param {string} algorithm - 算法名称
     * @param {string|Uint8Array} key - 可选的 HMAC 密钥
     * @returns {StreamHasher} 流式哈希器实例
     */
    static createHasher(algorithm, key = null) {
        return new StreamHasher(algorithm, key);
    }

    /**
     * 密码哈希 (使用 Argon2)
     * @param {string} password - 密码
     * @param {object} options - 选项
     * @returns {Promise<string>} 哈希后的密码
     */
    static async hashPassword(password, options = {}) {
        return await Bun.password.hash(password, options);
    }

    /**
     * 验证密码
     * @param {string} password - 原始密码
     * @param {string} hash - 哈希值
     * @returns {Promise<boolean>} 验证结果
     */
    static async verifyPassword(password, hash) {
        return await Bun.password.verify(password, hash);
    }

    /**
     * 快速哈希 (非密码学)
     * @param {string|Uint8Array} data - 数据
     * @param {number} seed - 种子值
     * @returns {number} 64位哈希值
     */
    static fastHash(data, seed = 0) {
        return Bun.hash(data, seed);
    }
}

/**
 * 流式哈希器类
 */
class StreamHasher {
    constructor(algorithm, key = null) {
        this.hasher = new Bun.CryptoHasher(algorithm, key);
        this.finalized = false;
    }

    /**
     * 更新数据
     * @param {string|Uint8Array} data - 数据
     * @returns {StreamHasher} 支持链式调用
     */
    update(data) {
        if (this.finalized) {
            throw new Error('哈希器已经完成，不能再更新数据');
        }
        this.hasher.update(data);
        return this;
    }

    /**
     * 生成最终哈希值
     * @param {string} encoding - 输出编码
     * @returns {string} 哈希值
     */
    digest(encoding = 'hex') {
        if (this.finalized) {
            throw new Error('哈希器已经完成');
        }
        this.finalized = true;
        return this.hasher.digest(encoding);
    }

    /**
     * 复制哈希器
     * @returns {StreamHasher} 新的哈希器实例
     */
    copy() {
        if (this.finalized) {
            throw new Error('不能复制已完成的哈希器');
        }
        const newHasher = new StreamHasher();
        newHasher.hasher = this.hasher.copy();
        return newHasher;
    }
}

// 使用示例：
// const md5Hash = Crypto.md5('hello world');
// const hmacMd5 = Crypto.hmacMd5('secret-key', 'hello world');
// const sha256Hash = Crypto.sha256('hello world');
// const fileHash = await Crypto.hashFile('./file.txt', 'md5');
// const hasher = Crypto.createHasher('md5').update('hello').update(' world');
// const result = hasher.digest('hex');
