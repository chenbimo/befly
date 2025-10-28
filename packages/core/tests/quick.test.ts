/**
 * 快速测试 - 验证核心功能正常工作
 */

import { describe, test, expect } from 'bun:test';
import { Yes, No } from '../util.js';
import { Cipher } from '../lib/cipher.js';

describe('核心工具', () => {
    test('Yes 应该返回成功响应', () => {
        const result = Yes('成功', { id: 1 });
        expect(result.code).toBe(0);
        expect(result.msg).toBe('成功');
        expect(result.data.id).toBe(1);
    });

    test('No 应该返回失败响应', () => {
        const result = No('失败');
        expect(result.code).toBe(1);
        expect(result.msg).toBe('失败');
    });
});

describe('加密工具', () => {
    test('MD5 应该生成哈希', () => {
        const hash = Cipher.md5('hello');
        expect(typeof hash).toBe('string');
        expect(hash.length).toBe(32);
    });

    test('SHA256 应该生成哈希', () => {
        const hash = Cipher.sha256('hello');
        expect(typeof hash).toBe('string');
        expect(hash.length).toBe(64);
    });

    test('HMAC-MD5 应该生成签名', () => {
        const signature = Cipher.hmacMd5('secret', 'data');
        expect(typeof signature).toBe('string');
        expect(signature.length).toBeGreaterThan(0);
    });
});
