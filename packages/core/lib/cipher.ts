/**
 * 加密工具类 - TypeScript 版本
 * 提供各种哈希、HMAC、密码加密等功能
 */

import { createSign } from 'node:crypto';

import type { EncodingType, HashAlgorithm, PasswordHashOptions } from 'befly-shared/types';

/**
 * 加密工具类
 */
export class Cipher {
    /**
     * MD5 哈希
     * @param data - 要哈希的数据
     * @param encoding - 输出编码
     * @returns MD5 哈希值
     */
    static md5(data: string | Uint8Array, encoding: EncodingType = 'hex'): string {
        const hasher = new Bun.CryptoHasher('md5');
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * HMAC-MD5 签名
     * @param key - 密钥
     * @param data - 要签名的数据
     * @param encoding - 输出编码
     * @returns HMAC-MD5 签名
     */
    static hmacMd5(key: string | Uint8Array, data: string | Uint8Array, encoding: EncodingType = 'hex'): string {
        const hasher = new Bun.CryptoHasher('md5', key);
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * SHA-1 哈希
     * @param data - 要哈希的数据
     * @param encoding - 输出编码
     * @returns SHA-1 哈希值
     */
    static sha1(data: string | Uint8Array, encoding: EncodingType = 'hex'): string {
        const hasher = new Bun.CryptoHasher('sha1');
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * HMAC-SHA1 签名
     * @param key - 密钥
     * @param data - 要签名的数据
     * @param encoding - 输出编码
     * @returns HMAC-SHA1 签名
     */
    static hmacSha1(key: string | Uint8Array, data: string | Uint8Array, encoding: EncodingType = 'hex'): string {
        const hasher = new Bun.CryptoHasher('sha1', key);
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * SHA-256 哈希
     * @param data - 要哈希的数据
     * @param encoding - 输出编码
     * @returns SHA-256 哈希值
     */
    static sha256(data: string | Uint8Array, encoding: EncodingType = 'hex'): string {
        const hasher = new Bun.CryptoHasher('sha256');
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * RSA-SHA256 签名
     * @param data - 要签名的数据
     * @param privateKey - 私钥
     * @param encoding - 输出编码
     * @returns RSA-SHA256 签名
     */
    static rsaSha256(data: string, privateKey: string | Buffer, encoding: BufferEncoding = 'hex'): string {
        const sign = createSign('RSA-SHA256');
        sign.update(data);
        const signature = sign.sign(privateKey, encoding);
        return signature;
    }

    /**
     * HMAC-SHA256 签名
     * @param key - 密钥
     * @param data - 要签名的数据
     * @param encoding - 输出编码
     * @returns HMAC-SHA256 签名
     */
    static hmacSha256(key: string | Uint8Array, data: string | Uint8Array, encoding: EncodingType = 'hex'): string {
        const hasher = new Bun.CryptoHasher('sha256', key);
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * SHA-512 哈希
     * @param data - 要哈希的数据
     * @param encoding - 输出编码
     * @returns SHA-512 哈希值
     */
    static sha512(data: string | Uint8Array, encoding: EncodingType = 'hex'): string {
        const hasher = new Bun.CryptoHasher('sha512');
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * HMAC-SHA512 签名
     * @param key - 密钥
     * @param data - 要签名的数据
     * @param encoding - 输出编码
     * @returns HMAC-SHA512 签名
     */
    static hmacSha512(key: string | Uint8Array, data: string | Uint8Array, encoding: EncodingType = 'hex'): string {
        const hasher = new Bun.CryptoHasher('sha512', key);
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * 通用哈希方法
     * @param algorithm - 算法名称
     * @param data - 要哈希的数据
     * @param encoding - 输出编码
     * @returns 哈希值
     */
    static hash(algorithm: HashAlgorithm, data: string | Uint8Array, encoding: EncodingType = 'hex'): string {
        const hasher = new Bun.CryptoHasher(algorithm);
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * 通用 HMAC 方法
     * @param algorithm - 算法名称
     * @param key - 密钥
     * @param data - 要签名的数据
     * @param encoding - 输出编码
     * @returns HMAC 签名
     */
    static hmac(algorithm: HashAlgorithm, key: string | Uint8Array, data: string | Uint8Array, encoding: EncodingType = 'hex'): string {
        const hasher = new Bun.CryptoHasher(algorithm, key);
        hasher.update(data);
        return hasher.digest(encoding);
    }

    /**
     * 文件哈希
     * @param filePath - 文件路径
     * @param algorithm - 算法名称
     * @param encoding - 输出编码
     * @returns 文件哈希值
     */
    static async hashFile(filePath: string, algorithm: HashAlgorithm = 'sha256', encoding: EncodingType = 'hex'): Promise<string> {
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
     * 密码哈希（使用 bcrypt 算法）
     * @param password - 密码
     * @param options - 选项（可选，支持自定义 cost 参数）
     * @returns 哈希后的密码（固定 60 字符）
     * @example
     * // 默认配置（推荐）
     * const hash = await Cipher.hashPassword('123456');
     *
     * // 自定义强度（可选）
     * const hash = await Cipher.hashPassword('123456', { cost: 12 });
     */
    static async hashPassword(password: string, options: PasswordHashOptions = {}): Promise<string> {
        const finalOptions = {
            algorithm: 'bcrypt',
            ...options
        } as any;
        return await Bun.password.hash(password, finalOptions);
    }

    /**
     * 验证密码
     * @param password - 原始密码
     * @param hash - 存储的哈希值（自动识别算法和提取盐值）
     * @returns 验证结果
     * @example
     * const isValid = await Cipher.verifyPassword('123456', storedHash);
     * if (isValid) {
     *   // 密码正确
     * }
     */
    static async verifyPassword(password: string, hash: string): Promise<boolean> {
        return await Bun.password.verify(password, hash);
    }

    /**
     * Base64 编码
     * @param data - 要编码的数据
     * @returns Base64 编码的字符串
     */
    static base64Encode(data: string): string {
        return Buffer.from(data, 'utf8').toString('base64');
    }

    /**
     * Base64 解码
     * @param data - Base64 编码的字符串
     * @returns 解码后的字符串
     */
    static base64Decode(data: string): string {
        return Buffer.from(data, 'base64').toString('utf8');
    }

    /**
     * 生成随机十六进制字符串
     * @param length - 字符串长度
     * @returns 随机十六进制字符串
     */
    static randomString(length: number): string {
        const bytes = Math.ceil(length / 2);
        const randomBytes = crypto.getRandomValues(new Uint8Array(bytes));
        let result = '';
        for (let i = 0; i < randomBytes.length; i++) {
            result += randomBytes[i].toString(16).padStart(2, '0');
        }
        return result.slice(0, length);
    }

    /**
     * 快速哈希 (非密码学)
     * @param data - 数据
     * @param seed - 种子值
     * @returns 64位哈希值
     */
    static fastHash(data: string | Uint8Array, seed: number = 0): number {
        return Bun.hash(data, seed);
    }
}
