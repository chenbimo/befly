/**
 * 加密工具测试 - TypeScript 版本
 * 测试 utils/crypto.ts 中的加密功能
 */

import { describe, it, expect } from 'bun:test';
import { Cipher } from '../lib/cipher.js';

describe('MD5 哈希', () => {
    it('md5 应该返回正确的哈希值', () => {
        const hash = Cipher.md5('hello');
        expect(hash).toBe('5d41402abc4b2a76b9719d911017c592');
    });

    it('md5 应该对不同输入返回不同哈希', () => {
        const hash1 = Cipher.md5('hello');
        const hash2 = Cipher.md5('world');
        expect(hash1).not.toBe(hash2);
    });

    it('md5 应该对相同输入返回相同哈希', () => {
        const hash1 = Cipher.md5('test');
        const hash2 = Cipher.md5('test');
        expect(hash1).toBe(hash2);
    });
});

describe('SHA256 哈希', () => {
    it('sha256 应该返回正确的哈希值', () => {
        const hash = Cipher.sha256('hello');
        expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('sha256 应该支持十六进制编码', () => {
        const hash = Cipher.sha256('test', 'hex');
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('sha256 应该支持 Base64 编码', () => {
        const hash = Cipher.sha256('test', 'base64');
        expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
});

describe('HMAC', () => {
    it('hmacMd5 应该返回正确的 HMAC', () => {
        const hmac = Cipher.hmacMd5('message', 'secret');
        expect(typeof hmac).toBe('string');
        expect(hmac).toMatch(/^[a-f0-9]{32}$/);
    });

    it('hmacSha256 应该返回正确的 HMAC', () => {
        const hmac = Cipher.hmacSha256('message', 'secret');
        expect(typeof hmac).toBe('string');
        expect(hmac).toMatch(/^[a-f0-9]{64}$/);
    });

    it('相同输入应该产生相同 HMAC', () => {
        const hmac1 = Cipher.hmacMd5('test', 'key');
        const hmac2 = Cipher.hmacMd5('test', 'key');
        expect(hmac1).toBe(hmac2);
    });

    it('不同密钥应该产生不同 HMAC', () => {
        const hmac1 = Cipher.hmacMd5('test', 'key1');
        const hmac2 = Cipher.hmacMd5('test', 'key2');
        expect(hmac1).not.toBe(hmac2);
    });
});

describe('密码加密', () => {
    it('hashPassword 应该返回加密后的密码', async () => {
        const hashed = await Cipher.hashPassword('password123');
        expect(typeof hashed).toBe('string');
        expect(hashed).not.toBe('password123');
    });

    it('verifyPassword 应该验证正确的密码', async () => {
        const password = 'mypassword';
        const hashed = await Cipher.hashPassword(password);
        const isValid = await Cipher.verifyPassword(password, hashed);
        expect(isValid).toBe(true);
    });

    it('verifyPassword 应该拒绝错误的密码', async () => {
        const password = 'mypassword';
        const hashed = await Cipher.hashPassword(password);
        const isValid = await Cipher.verifyPassword('wrongpassword', hashed);
        expect(isValid).toBe(false);
    });

    it('相同密码应该产生不同哈希（salt）', async () => {
        const password = 'test123';
        const hash1 = await Cipher.hashPassword(password);
        const hash2 = await Cipher.hashPassword(password);
        expect(hash1).not.toBe(hash2);
    });
});

describe('Base64 编码', () => {
    it('base64Encode 应该正确编码', () => {
        const encoded = Cipher.base64Encode('hello');
        expect(encoded).toBe('aGVsbG8=');
    });

    it('base64Decode 应该正确解码', () => {
        const decoded = Cipher.base64Decode('aGVsbG8=');
        expect(decoded).toBe('hello');
    });

    it('编码后解码应该得到原文', () => {
        const original = 'test message 测试';
        const encoded = Cipher.base64Encode(original);
        const decoded = Cipher.base64Decode(encoded);
        expect(decoded).toBe(original);
    });
});

describe('随机字符串', () => {
    it('randomString 应该返回指定长度的字符串', () => {
        const str = Cipher.randomString(16);
        expect(str.length).toBe(16);
    });

    it('randomString 应该返回十六进制字符', () => {
        const str = Cipher.randomString(32);
        expect(str).toMatch(/^[a-f0-9]{32}$/);
    });

    it('多次调用应该返回不同的字符串', () => {
        const str1 = Cipher.randomString(16);
        const str2 = Cipher.randomString(16);
        expect(str1).not.toBe(str2);
    });
});
